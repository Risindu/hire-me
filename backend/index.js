import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import pdf from 'pdf-parse';
import { google } from 'googleapis';
import fs from 'fs';
import axios from 'axios';
import nodemailer from 'nodemailer';
import schedule from 'node-schedule';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Use Render's PORT or fallback to 3000

app.use(cors());
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded request bodies

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Configure AWS S3 Client (v3)
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: 'https://www.googleapis.com/auth/spreadsheets',
});

const sheets = google.sheets({ version: 'v4', auth });

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASSWORD, // Your email password or App Password
  },
});

// Function to send follow-up email
async function sendFollowUpEmail(email, name) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your CV is Under Review',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <div style="text-align: left;">
          <img src="https://res.cloudinary.com/ds01hgimc/image/upload/v1741252826/hire_itom64.png" alt="Company Logo" style="width: 150px; margin-bottom: 20px;">
        </div>
        <p>Dear ${name},</p>
        <p>Thank you for submitting your CV. We are currently reviewing your application and will get back to you soon.</p>
        <p>Best regards,<br>Hire Me Team</p>
        <hr>
        <p style="font-size: 0.9em; color: #555;">This is an automated message, please do not reply.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Follow-up email sent successfully');
  } catch (error) {
    console.error('Error sending follow-up email:', error);
  }
}

// Function to schedule follow-up email
function scheduleFollowUpEmail(email, name) {
  // Schedule the email to be sent at 10 AM the next day
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0); // 10 AM

  schedule.scheduleJob(date, function () {
    sendFollowUpEmail(email, name);
  });
}

// Handle CV parsing and Google Sheets integration
app.post('/parse-cv', upload.single('cv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File not uploaded' });
  }

  try {
    // Extract name, email, and phone from the request body
    const { name, email, phone } = req.body;

    // Check if the test PDF file exists
    const testPdfPath = './test/data/05-versions-space.pdf';
    if (!fs.existsSync(testPdfPath)) {
      return res.status(404).json({ error: 'Test PDF file not found' });
    }

    // Extract text from the PDF
    const data = await pdf(req.file.buffer);
    const text = data.text;

    // Extract information from the CV
    const personalInfo = extractPersonalInfo(text);
    const education = extractEducation(text);
    const qualifications = extractQualifications(text);
    const experience = extractExperience(text);
    const skills = extractSkills(text);
    const projects = extractProjects(text);

    // Upload the CV to S3 and get the pre-signed URL
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `${Date.now()}_${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    // Generate a pre-signed URL
    const getObjectParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: params.Key,
    };

    const getObjectCommand = new GetObjectCommand(getObjectParams);
    const preSignedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });

    // Store data in Google Sheets
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = 'Sheet1!A2';

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            `${personalInfo.name}\n${personalInfo.email}\n${personalInfo.phone}`,
            education.join('\n'),
            qualifications.join('\n'),
            experience.join('\n'),
            skills.join('\n'),
            projects.join('\n'),
            preSignedUrl,
          ],
        ],
      },
    });

    // Prepare the payload for the webhook
    const webhookPayload = {
      cv_data: {
        personal_info: {
          name: personalInfo.name,
          email: personalInfo.email,
          phone: personalInfo.phone,
        },
        education: education,
        qualifications: qualifications,
        projects: projects,
        cv_public_link: preSignedUrl,
      },
      metadata: {
        applicant_name: name, // Use the name from the frontend request
        email: email, // Use the email from the frontend request
        status: "testing", // Change to "prod" for final submissions
        cv_processed: true,
        processed_timestamp: new Date().toISOString(),
      },
    };

    // Log the payload for debugging
    console.log('Sending webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // Send the HTTP request to the webhook endpoint
    try {
      const webhookResponse = await axios.post(
        'https://md-assignment.automations-3d6.workers.dev/',
        webhookPayload,
        {
          headers: {
            'X-Candidate-Email': email, // Use the email from the frontend request
          },
        }
      );
      console.log('Webhook response:', webhookResponse.data);
    } catch (error) {
      console.error('Webhook error:', error.response ? error.response.data : error.message);
    }

    // Schedule the follow-up email
    scheduleFollowUpEmail(email, name);

    res.json({
      message: 'CV parsed, data stored in Google Sheets, and follow-up email scheduled!',
      personalInfo,
      education,
      qualifications,
      experience,
      skills,
      projects,
      cvLink: preSignedUrl,
    });
  } catch (error) {
    console.error('Error parsing CV or updating Google Sheet:', error);
    res.status(500).json({ error: 'Error processing CV' });
  }
});

// Helper functions to extract information from CV text
function extractPersonalInfo(text) {
  const nameMatch = text.match(/Name:\s*(.+)/i);
  const emailMatch = text.match(/Email:\s*(.+)/i);
  const phoneMatch = text.match(/Phone:\s*(.+)/i);

  return {
    name: nameMatch ? nameMatch[1].trim() : 'Not found',
    email: emailMatch ? emailMatch[1].trim() : 'Not found',
    phone: phoneMatch ? phoneMatch[1].trim() : 'Not found',
  };
}

function extractEducation(text) {
  const educationMatch = text.match(/Education:(.+?)Qualifications:/is);
  return educationMatch ? educationMatch[1].trim().split('\n').filter(line => line.trim()) : [];
}

function extractQualifications(text) {
  const qualificationsMatch = text.match(/Qualifications:(.+?)Projects:/is);
  return qualificationsMatch ? qualificationsMatch[1].trim().split('\n').filter(line => line.trim()) : [];
}

function extractExperience(text) {
  const experienceMatch = text.match(/Experience:(.+?)Skills:/is);
  return experienceMatch ? experienceMatch[1].trim().split('\n').filter(line => line.trim()) : [];
}

function extractSkills(text) {
  const skillsMatch = text.match(/Skills:([\s\S]+?)(Languages:|Achievements:|References:|$)/i);
  if (skillsMatch) {
    const skillsText = skillsMatch[1].trim();
    return skillsText.split('\n').filter(line => line.trim());
  }
  return [];
}

function extractProjects(text) {
  const projectsMatch = text.match(/Projects:([\s\S]+?)(Skills:|Experience:|Qualifications:|Education:|$)/i);
  if (projectsMatch) {
    const projectsText = projectsMatch[1].trim();
    return projectsText.split('\n').filter(line => line.trim());
  }
  return [];
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});