import http from 'http';

const data = JSON.stringify({
    encounterId: "123e4567-e89b-12d3-a456-426614174000",
    transcript: "This is a test transcript for the AI to process and summarize into a progress note.",
    noteType: "progress_note",
    noteFormat: "SOAP"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/ai/generate-note',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${body}`);
    });
});

req.on('error', (e) => { console.error(`Problem with request: ${e.message}`); });
req.write(data);
req.end();
