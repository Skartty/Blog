import express from 'express';
import { randomBytes } from 'node:crypto';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const posts = [];

app.get('/posts', (req, res) => {
    res.send(posts);
});

app.post('/posts', async (req, res) => {
    const { title } = req.body || {};

    if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).send({ error: 'Informe o título do post.' });
    }

    const id = randomBytes(4).toString('hex');
    const newPost = { id, title };
    posts.push(newPost);

    try {
        const response = await fetch('http://localhost:4005/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'PostCreated', id, title })
        });

        if (!response.ok) {
            throw new Error(`Event Bus respondeu com status ${response.status}`);
        }
    } catch (error) {
        console.error('Erro ao publicar PostCreated:', error.message);
        return res.status(503).send({ error: 'Não foi possível publicar o post no Event Bus.' });
    }

    res.status(201).send(newPost);
});

app.post('/events', (req, res) => {
    console.log('Evento recebido por Posts:', req.body);
    res.send({});
});

app.listen(4000, () => {
    console.log('Posts service listening on 4000!');
});
