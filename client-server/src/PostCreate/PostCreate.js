import { useState } from 'react';
import './PostCreate.css';

const PostCreate = ({ onPostCreated }) => {
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (event) => {
        event.preventDefault();

        if (!title.trim()) {
            return;
        }

        setError('');
        setSubmitting(true);

        try {
            const response = await fetch('http://localhost:4000/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Não foi possível criar o post.');
            }

            setTitle('');
            await onPostCreated();
        } catch (error) {
            console.error('Erro ao criar post:', error);
            setError(error.message === 'Failed to fetch'
                ? 'Não foi possível criar o post. Função indisponível.'
                : error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="post-create">
            <h1>Criar uma publicação</h1>
            <form onSubmit={onSubmit}>
                <div className="form">
                    <label htmlFor="post-title">Título</label>
                    <input
                        id="post-title"
                        value={title}
                        onChange={event => setTitle(event.target.value)}
                        className="field"
                        placeholder="Sobre o que você quer falar?"
                        required
                    />
                </div>
                <button type="submit" className="button" disabled={submitting}>
                    Publicar
                </button>
            </form>
            {error && <p role="alert">{error}</p>}
        </section>
    );
};

export default PostCreate;
