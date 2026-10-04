import express from 'express';
import { randomBytes } from 'node:crypto';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const commentsByPostId = {};

const sendEvent = async (event) => {
    const response = await fetch('http://localhost:4005/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
    });

    if (!response.ok) {
        throw new Error(`Event Bus respondeu com status ${response.status}`);
    }
};

app.get('/posts/:id/comments', (req, res) => {
    res.send(commentsByPostId[req.params.id] || []);
});

app.get('/comments/:commentId/status', (req, res) => {
    const comment = Object.values(commentsByPostId)
        .flat()
        .find(comment => comment.id === req.params.commentId);

    if (!comment) {
        return res.status(404).send({ error: 'Comentário não encontrado.' });
    }

    res.send({ id: comment.id, status: comment.status, reason: comment.reason });
});

app.post('/posts/:id/comments', async (req, res) => {
    const postId = req.params.id;
    const { content } = req.body || {};

    if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).send({ error: 'Informe o conteúdo do comentário.' });
    }

    const commentId = randomBytes(4).toString('hex');
    const comments = commentsByPostId[postId] || [];
    const newComment = {
        id: commentId,
        content,
        status: 'pending',
        reason: null
    };

    comments.push(newComment);
    commentsByPostId[postId] = comments;

    try {
        await sendEvent({ type: 'CommentCreated', ...newComment, postId });
    } catch (error) {
        console.error('Erro ao publicar CommentCreated:', error.message);
        return res.status(503).send({ error: 'Não foi possível publicar o comentário no Event Bus.' });
    }

    // O frontend usa o ID retornado para acompanhar a moderação.
    res.status(201).send(newComment);
});

app.post('/events', async (req, res) => {
    const event = req.body || {};
    console.log('Evento recebido por Comments:', event);

    if (event.type === 'CommentModerated') {
        const { id, postId, status, reason } = event;
        const comment = commentsByPostId[postId]?.find(comment => comment.id === id);

        if (!comment) {
            console.log(`Comentário ${id} do post ${postId} não encontrado em Comments.`);
            return res.send({});
        }

        comment.status = status;
        comment.reason = reason;

        try {
            await sendEvent({ type: 'CommentUpdated', ...comment, postId });
        } catch (error) {
            console.error('Erro ao publicar CommentUpdated:', error.message);
            return res.status(503).send({ error: 'Não foi possível publicar CommentUpdated.' });
        }
    }

    res.send({});
});

app.listen(4001, () => {
    console.log('Comments service listening on 4001!');
});
