import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import triggerRouter  from './routes/trigger.routes.js';
import familyRouter from './routes/family.routes.js';
import ambulanceRouter from './routes/ambulance.routes.js';
import smsRouter from "./routes/sms.routes.js"

dotenv.config();
const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', triggerRouter); // therapist call
app.use('/', familyRouter); 
app.use('/', ambulanceRouter);
app.use('/', smsRouter);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
