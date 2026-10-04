import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const consumerPorts = [4000, 4001, 4002, 4003];

const sendEvent = async (port, event) => {
    const response = await fetch(`http://localhost:${port}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    await response.json();
};

app.post('/events', async (req, res) => {
    const event = req.body || {};
    console.log('Evento recebido pelo Event Bus:', event);

    // Cada entrega é independente; uma falha não cancela as demais.
    const results = await Promise.allSettled(
        consumerPorts.map(port => sendEvent(port, event))
    );

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(
                `Falha ao entregar ${event.type} ao serviço na porta ${consumerPorts[index]}:`,
                result.reason.message
            );
        }
    });

    res.send({ msg: 'Evento distribuído aos consumidores disponíveis.' });
});

app.listen(4005, () => {
    console.log('Event bus listening on port 4005!');
});
