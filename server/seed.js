const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const dotenv = require('dotenv');
const dns = require('dns');

// Override DNS servers to use Google DNS for MongoDB Atlas compatibility
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

const { resolveMongoUri } = require('./mongoConnectionHelper');

const seedAdmin = async () => {
    try {
        const rawUri = process.env.MONGO_URI || 'mongodb://localhost:27017/scribeai';
        console.log('Connecting to MongoDB at:', rawUri);
        
        const resolvedUri = await resolveMongoUri(rawUri);
        await mongoose.connect(resolvedUri);
        
        console.log('Connected to MongoDB.');

        const email = 'admin@scribeai.com';
        const password = 'Password123';

        // Check if admin already exists
        const adminExists = await User.findOne({ email });
        if (adminExists) {
            console.log(`\n✨ Test Admin account already exists!`);
            console.log(`📧 Email:    ${email}`);
            console.log(`🔑 Password: ${password}\n`);
            process.exit(0);
        }

        // Create hashed password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Save admin user
        await User.create({
            name: 'Developer Admin',
            email,
            passwordHash
        });

        console.log(`\n🚀 Test Admin account created successfully!`);
        console.log(`📧 Email:    ${email}`);
        console.log(`🔑 Password: ${password}\n`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding test admin:', error);
        process.exit(1);
    }
};

seedAdmin();
