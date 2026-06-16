import { Resend } from 'resend';
import { env } from './env.js';

// Initialize the Resend SDK with our strictly validated API key
const resend = new Resend(env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // 1. Fire the request to Resend's Edge Network
    const { data, error } = await resend.emails.send({
      from: `"Gaprio Systems" <${env.FROM_EMAIL}>`, 
      to,
      subject,
      html,
      // Fallback: If no text is provided, strip HTML tags for plain text clients
      text: text || html.replace(/<[^>]*>?/gm, ''), 
    });
    
    // 2. Catch API Rejections (e.g., unverified domain, bounced email)
    if (error) {
      console.error(`🚨 [Resend Blocked] Failed to send email to ${to}:`, error.message);
      throw new Error(`Email dispatch failed: ${error.message}`); 
    }
    
    // 3. Log success in development for easy debugging
    if (env.NODE_ENV === 'development') {
      console.log(`📧 Email successfully dispatched to ${to} | Transaction ID: ${data.id}`);
    }
    
    return data;
  } catch (error) {
    // Catch network crashes or internal SDK failures
    console.error(`💥 [Mail Service Crash]:`, error.message);
    throw error; // Throwing it allows catchAsync in the controller to handle it gracefully
  }
};

export default resend;