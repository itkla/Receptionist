// src/components/emails/PasswordResetEmail.tsx
import React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Link,
} from '@react-email/components'; // Or your preferred email library

interface PasswordResetEmailProps {
  userFirstName?: string | null;
  resetPasswordLink: string;
}

export default function PasswordResetEmail({
  userFirstName,
  resetPasswordLink,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reset Your Password</Heading>
          <Text style={text}>
            Hi {userFirstName || 'there'},
          </Text>
          <Text style={text}>
            Someone requested a password reset for your account. If this was you, click the button below to set a new password. This link will expire in 60 minutes.
          </Text>
          <Button style={button} href={resetPasswordLink}>
            Reset Password
          </Button>
          <Text style={text}>
            If you didn't request this, you can safely ignore this email.
          </Text>
          <Text style={text}>
            Or copy and paste this URL into your browser: <Link href={resetPasswordLink} style={link}>{resetPasswordLink}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Basic styles (customize as needed)
const main = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '580px',
};

const h1 = {
  color: '#000000',
  fontSize: '24px',
  fontWeight: 'normal',
  textAlign: 'center' as const, // Required for type checking
  margin: '30px 0',
  padding: '0',
};

const text = {
  color: '#000000',
  fontSize: '14px',
  lineHeight: '24px',
};

const button = {
  backgroundColor: '#000000',
  borderRadius: '5px',
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const, // Required for type checking
  display: 'block',
  width: '200px',
  padding: '12px 0',
  margin: '20px auto',
};

const link = {
  color: '#000000',
  textDecoration: 'underline',
};