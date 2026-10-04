import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// Modelo de leitura em memória: cada post contém sua lista de comentários.
const posts = {};

app.get('/posts', (req, res) => {
    res.send(posts);
});

app.post('/events', (req, res) => {
    const event = req.body || {};
    const { type } = event;
    console.log('Evento recebido por Query:', event);

    if (type === 'PostCreated') {
        const { id, title } = event;
        posts[id] = { id, title, comments: posts[id]?.comments || [] };
    }

    if (type === 'CommentCreated' || type === 'CommentUpdated') {
        const { id, content, postId, status, reason } = event;
        const post = posts[postId];

        if (!post) {
            console.log(`Post ${postId} não encontrado em Query.`);
            return res.send({});
        }

        const comment = post.comments.find(comment => comment.id === id);

        if (!comment) {
            // CommentUpdated pode chegar antes de CommentCreated na distribuição paralela.
            post.comments.push({ id, content, status, reason });
        } else if (type === 'CommentUpdated') {
            comment.content = content;
            comment.status = status;
            comment.reason = reason;
        }
        // Um CommentCreated atrasado não deve substituir o resultado da moderação.
    }

    res.send({});
});

app.listen(4002, () => {
    console.log('Query service listening on 4002!');
});
