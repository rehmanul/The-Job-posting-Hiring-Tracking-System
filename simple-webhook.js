import express from 'express';

const app = express();
app.use(express.json());
app.use(express.text());

app.all('/api/linkedin/webhook', (req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Query:', req.query);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  if (req.query.challenge) {
    console.log('Sending challenge:', req.query.challenge);
    return res.status(200).send(req.query.challenge);
  }
  
  res.status(200).send('OK');
});

app.listen(3002, () => {
  console.log('Simple webhook server running on port 3002');
  console.log('Update ngrok to: ngrok http 3002');
});