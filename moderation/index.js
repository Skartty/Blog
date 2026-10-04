import express from 'express';

const blockedWords = [
    'idiota',
    'spam'
];

const blockedCharacters = [
    '@',
    '#'
];

const app = express();
app.use(express.json());

app.post('/events', async (req, res) => {
    const event = req.body || {};

    if (event.type !== 'CommentCreated') {
        return res.send({});
    }

    const { id, content, postId } = event;

    if (typeof content !== 'string') {
        return res.status(400).send({ error: 'O comentário precisa ter conteúdo em texto.' });
    }

    const normalizedContent = content.toLowerCase();
    const blockedWord = blockedWords.find(word => normalizedContent.includes(word.toLowerCase()));
    const blockedCharacter = blockedCharacters.find(character => content.includes(character));
    let status = 'approved';
    let reason = null;

    if (blockedWord) {
        status = 'rejected';
        reason = `A palavra "${blockedWord}" não é permitida.`;
    } else if (blockedCharacter) {
        status = 'rejected';
        reason = `O caractere "${blockedCharacter}" não é permitido.`;
    }

    try {
        const response = await fetch('http://localhost:4005/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'CommentModerated', id, content, postId, status, reason })
        });

        if (!response.ok) {
            throw new Error(`Event Bus respondeu com status ${response.status}`);
        }
    } catch (error) {
        console.error('Erro ao publicar CommentModerated:', error.message);
        return res.status(503).send({ error: 'Não foi possível publicar CommentModerated.' });
    }

    res.send({});
});

app.listen(4003, () => {
    console.log('Moderation service listening on 4003!');
});
