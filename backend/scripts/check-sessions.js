require('dotenv').config();
const mongoose = require('mongoose');
const Session = require('../src/models/session.model');

async function checkSessions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const sessions = await Session.find().lean();
    console.log('\nActive Sessions:', sessions.length);
    
    sessions.forEach((session, index) => {
      console.log(`\nSession ${index + 1}:`);
      console.log('User ID:', session.userId);
      console.log('Created:', session.createdAt);
      console.log('Last Used:', session.lastUsed);
      console.log('Cookies:', session.cookies.length);
      console.log('localStorage Items:', session.localStorage.length);
      console.log('sessionStorage Items:', session.sessionStorage.length);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSessions(); 