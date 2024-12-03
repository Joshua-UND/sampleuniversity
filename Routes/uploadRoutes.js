const express = require('express');
const multer = require('../multerConfig');
const uploadController = require('../controllers/uploadController'); // Ensure the correct path

const router = express.Router();

// Route to fetch students by level
router.get('/students/:level', uploadController.getStudentsByLevel);

// Route for uploading results with multer middleware
router.post('/upload-result', multer.single('file'), (req, res, next) => {
    // Log the incoming request to check file data
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);

    // Proceed with the controller method
    uploadController.uploadResult(req, res).catch(next);
});

module.exports = router;
