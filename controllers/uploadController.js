const B2 = require('backblaze-b2');
const Result = require('../models/result');
const Student = require('../models/student');
const sendEmail = require('../controllers/sendEmail');

// Initialize Backblaze B2 client
const b2 = new B2({
    applicationKeyId: process.env.BACKBLAZE_APP_KEY_ID,
    applicationKey: process.env.BACKBLAZE_APP_KEY,
});

// Authorize B2 client
(async () => {
    try {
        await b2.authorize();
        console.log('Backblaze B2 authorized successfully.');
    } catch (error) {
        console.error('Failed to authorize Backblaze B2:', error.message);
    }
})();

const bucketName = 'resultportal';

// Fetch students by level
const getStudentsByLevel = async (req, res) => {
    try {
        const level = parseInt(req.params.level, 10);
        if (isNaN(level)) {
            return res.status(400).json({ message: 'Invalid level parameter' });
        }

        const students = await Student.find({ level });
        res.status(200).json(students);
    } catch (error) {
        console.error('Error fetching students:', error.message);
        res.status(500).json({ message: 'Error fetching students' });
    }
};

// Upload result
const uploadResult = async (req, res) => {
    const { file } = req;
    const { matricNumber, level, semester } = req.body;

    if (!file || !matricNumber || !level || !semester) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const numericLevel = parseInt(level, 10);
        const student = await Student.findOne({ matric_number: matricNumber });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const existingResult = await Result.findOne({
            studentId: student._id,
            level: numericLevel,
            semester,
        });

        if (existingResult) {
            return res.status(400).json({ message: 'Result already exists' });
        }

        const b2FileName = `${matricNumber}-${numericLevel}-semester${semester}-${file.originalname}`;

        console.log(`Preparing to upload file: ${b2FileName}`);

        // Get bucket ID
        const bucketResponse = await b2.getBucket({ bucketName });
        if (!bucketResponse.data || bucketResponse.data.buckets.length === 0) {
            throw new Error('No buckets found in Backblaze');
        }
        const bucketId = bucketResponse.data.buckets[0].bucketId;
        console.log('Bucket ID retrieved:', bucketId);

        // Get an upload URL
        const uploadUrlResponse = await b2.getUploadUrl({ bucketId });
        const uploadUrl = uploadUrlResponse.data.uploadUrl;
        const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

        console.log('Upload URL and auth token retrieved.');

        // Upload file to Backblaze B2
        const uploadResponse = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken,
            fileName: b2FileName,
            data: file.buffer, // Use the buffer directly
            mime: file.mimetype,
        });

        console.log('Backblaze upload response:', uploadResponse);

        if (!uploadResponse || !uploadResponse.data || !uploadResponse.data.fileId) {
            throw new Error('File upload failed on Backblaze B2');
        }

        const b2Url = `https://f005.backblazeb2.com/file/${bucketName}/${b2FileName}`;
        console.log('File successfully uploaded. URL:', b2Url);

        const result = await Result.create({
            studentId: student._id,
            matric_number: matricNumber,
            level: numericLevel,
            semester,
            result_url: b2Url,
        });

        student.results.push(result._id);
        await student.save();

        await sendEmail({
            from: 'sampleuniversity@outlook.com',
            to: student.email,
            subject: 'Result Uploaded',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #333;">Result Upload Notification</h2>
                        <p style="color: #555;">${matricNumber} - ${numericLevel} Level</p>
                    </div>
                    <div style="padding: 10px; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <p style="color: #333;">Dear ${student.name},</p>
                        <p style="color: #555; line-height: 1.6;">
                            Your <strong>${numericLevel} Level</strong>, <strong>Semester ${semester}</strong> result has been successfully uploaded to our portal.
                        </p>
                        <p style="color: #555;">You can view your result by clicking the link below:</p>
                        <a href="${b2Url}" style="display: inline-block; padding: 10px 15px; background-color: #007BFF; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">View Result</a>
                        <p style="color: #999; font-size: 12px; margin-top: 20px;">If the link doesn't work, copy and paste the following URL into your browser: <br><a href="${b2Url}" style="color: #007BFF;">${b2Url}</a></p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
                        <p>&copy; 2024 SAMPLE University. All rights reserved.</p>
                    </div>
                </div>
            `,
        });
        
        res.status(201).json({ message: 'Result uploaded successfully', url: b2Url });
    } catch (error) {
        console.error('Error during upload:', error.message);
        res.status(500).json({ message: 'Error uploading result', error: error.message });
    }
};

module.exports = { getStudentsByLevel, uploadResult };
