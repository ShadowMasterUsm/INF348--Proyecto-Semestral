const express = require('express');
const morgan = require('morgan');
const app = express();
require('dotenv').config();

const routes = require('./src/routes/index');

app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

app.use(morgan('dev'));
app.use(express.json());
app.use(routes);

app.listen(process.env.PORT_API, () => {
    console.log('Server running!');
});