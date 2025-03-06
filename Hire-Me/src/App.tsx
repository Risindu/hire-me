import React, { useState } from 'react';
import { Button, TextField, Card, CardContent, Typography, Box, Container } from '@mui/material';
import './App.css';

interface FormData {
  name: string;
  email: string;
  phone: string;
  cv: File | null;
}

const JobApplicationForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    cv: null,
  });

  const [uploading, setUploading] = useState(false);
  const [cvUrl, setCvUrl] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.cv) {
      setUploading(true);

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('cv', formData.cv);

      try {
        // Parse CV and store data in Google Sheets
        const parseResponse = await fetch('http://localhost:3000/parse-cv', {
          method: 'POST',
          body: formDataToSend,
        });

        const parseResult = await parseResponse.json();

        if (parseResponse.ok) {
          setCvUrl(parseResult.cvLink);
          alert('Application submitted and CV parsed successfully!');
          console.log('Parsed Data:', parseResult);
        } else {
          alert('Failed to parse CV. Please try again.');
          console.error(parseResult.error);
        }
      } catch (error) {
        alert('Something went wrong. Please try again.');
        console.error('Upload or parse error:', error);
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <Box className="min-h-screen flex items-center justify-center">
      <Container maxWidth="lg">
        <Card className="shadow-xl rounded-2xl pulse">
          <CardContent>
            <Typography variant="h4" className="text-center mb-6 text-green-700">
              Job Application Form
            </Typography>
            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                type="text"
                name="name"
                label="Full Name"
                value={formData.name}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                className="form-element animated-input"
              />
              <TextField
                type="email"
                name="email"
                label="Email Address"
                value={formData.email}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                className="form-element animated-input"
              />
              <TextField
                type="tel"
                name="phone"
                label="Phone Number"
                value={formData.phone}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                className="form-element animated-input"
              />
              <TextField
                type="file"
                name="cv"
                inputProps={{ accept: ".pdf, .docx" }}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                className="form-element animated-input"
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                className="w-full form-element"
                disabled={uploading}
                sx={{
                  backgroundColor: '#66bb6a',
                  '&:hover': {
                    backgroundColor: '#43a047',
                  },
                }}
              >
                {uploading ? 'Uploading...' : 'Submit Application'}
              </Button>
            </form>
            {cvUrl && (
              <Typography variant="body1" className="mt-4 text-blue-700">
                CV Uploaded: <a href={cvUrl} target="_blank" rel="noopener noreferrer">View CV</a>
              </Typography>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default JobApplicationForm;