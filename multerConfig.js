const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|jpeg|jpg|png/;
        const isValidType = allowedTypes.test(file.mimetype);
        const isValidExt = allowedTypes.test(file.originalname.split('.').pop().toLowerCase());

        if (isValidType && isValidExt) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPEG, JPG, and PNG are allowed.'));
        }
    },
});

module.exports = upload;
