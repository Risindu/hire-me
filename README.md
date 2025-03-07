# **Job Application Processing Pipeline**

This project is a **Job Application Processing Pipeline** that automates the handling of CVs and extracts relevant information. It consists of a **frontend** (React) and a **backend** (Node.js) that work together to process job applications, store CVs in AWS S3, extract data, and send follow-up emails.

---

## **Features**
- **Frontend**:
  - A user-friendly job application form.
  - Accepts name, email, phone number, and CV upload (PDF or DOCX).
  - Built with **React** and **Vite**.

- **Backend**:
  - Processes uploaded CVs and extracts key information (e.g., education, qualifications, projects).
  - Stores CVs in **AWS S3** and generates pre-signed URLs for access.
  - Saves extracted data to **Google Sheets**.
  - Sends follow-up emails to applicants using **Nodemailer**.
  - Built with **Node.js**, **Express**, and **AWS SDK v3**.

---

## **Tech Stack**
- **Frontend**:
  - React
  - Vite
  - Material-UI (MUI)

- **Backend**:
  - Node.js
  - Express
  - AWS SDK v3 (S3)
  - Google Sheets API
  - Nodemailer (for email automation)
  - Multer (for file uploads)

- **Hosting**:
  - Frontend: Hosted on **AWS EC2**.
  - Backend: Hosted on **AWS EC2**.

---

## **Live Demo**
You can access the live frontend GUI at:
👉 **[http://52.90.186.218/](http://52.90.186.218/)**

---

## **Prerequisites**
Before running the project, ensure you have the following installed:
- **Node.js** (v16 or higher)
- **npm** (v8 or higher)
- **AWS CLI** (for AWS S3 configuration)
- **Google Cloud Console** (for Google Sheets API credentials)
- **Git** (for cloning the repository)

---

## **Setup Instructions**

### **1. Clone the Repository**
```bash
git clone https://github.com/Risindu/job-application-pipeline.git
cd job-application-pipeline
