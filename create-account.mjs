const payload = {
    practice: {
        name: "Demo Practice",
        npi: "1234567890",
        specialty: "behavioral_health",
        address: { city: "New York" }
    },
    admin: {
        firstName: "Adam",
        lastName: "Admin",
        email: "adam@example.com",
        password: "Password123456!"
    }
};

fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
}).then(r => r.json()).then(console.log).catch(console.error);
