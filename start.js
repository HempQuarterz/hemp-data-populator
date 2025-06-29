// This file ensures environment variables are loaded before anything else
require('dotenv').config();

// Now load the actual application
require('./dist/index.js');