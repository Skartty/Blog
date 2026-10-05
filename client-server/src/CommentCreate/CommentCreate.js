import { useEffect, useState } from 'react';
import './CommentCreate.css';

const CommentCreate = ({ postId, onCommentApproved }) => {
    const [content, setContent] = useState('');
    const [error, setError] = useState('');
    const [commentId, setCommentId] = useState(null);
    const [moderationStatus, setModerationStatus] = useState(null);
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (!commentId) {
            return;
        }

        let active = true;
        let timer;
        const controller = new AbortController();

        const checkStatus = async () => {
            try {
                const response = await fetch(`http://localhost:4001/comments/${commentId}/status`, {
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error('Não foi possível consultar a moderação. Função indisponível.');
                }

                const result = await response.json();

                if (!active) {
                    return;
                }

                if (result.status === 'pending') {
                    timer = setTimeout(checkStatus, 1000);
                } else if (result.status === 'approved') {
                    await onCommentApproved();

                    if (active) {
                        setModerationStatus('approved');
                        setCommentId(null);
                    }
                } else if (result.status === 'rejected') {
                    setReason(result.reason || 'O comentário não atende às regras de moderação.');
                    setModerationStatus('rejected');
                    setCommentId(null);
                } else {
                    throw new Error('O serviço retornou um estado de moderação desconhecido.');
                }
            } catch {
                if (active) {
                    setError('O comentário foi enviado, mas não foi possível consultar a moderação. Função indisponível.');
                    setModerationStatus(null);
                    setCommentId(null);
                }
            }
        };

        checkStatus();

        return () => {
            active = false;
            clearTimeout(timer);
            controller.abort();
        };
    }, [commentId, onCommentApproved]);

    const onSubmit = async (event) => {
        event.preventDefault();

        if (!content.trim() || moderationStatus === 'checking') {
            return;
        }

        setError('');
        setReason('');
        setModerationStatus('checking');

        try {
            const response = await fetch(`http://localhost:4001/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Não foi possível criar o comentário.');
            }

            const comment = await response.json();
            setContent('');
            setCommentId(comment.id);
        } catch (error) {
            console.error('Erro ao criar comentário:', error);
            setError(error.message === 'Failed to fetch'
                ? 'Não foi possível criar o comentário. Função indisponível.'
                : error.message);
            setModerationStatus(null);
        }
    };

    return (
        <div className="comment-create">
            <form onSubmit={onSubmit}>
                <input
                    aria-label="Comentário"
                    value={content}
                    onChange={event => setContent(event.target.value)}
                    placeholder="Escreva um comentário..."
                    disabled={moderationStatus === 'checking'}
                    required
                />
                <button type="submit" disabled={moderationStatus === 'checking'}>Enviar</button>
            </form>
            {moderationStatus && (
                <div
                    className={`comment-feedback comment-feedback-${moderationStatus}`}
                    role={moderationStatus === 'rejected' ? 'alert' : 'status'}
                >
                    {moderationStatus === 'checking' && <p>Seu comentário está sendo verificado...</p>}
                    {moderationStatus === 'approved' && <p>Comentário publicado com sucesso.</p>}
                    {moderationStatus === 'rejected' && (
                        <>
                            <p>Seu comentário não pôde ser publicado.</p>
                            <p>Motivo: {reason}</p>
                        </>
                    )}
                </div>
            )}
            {error && <p className="comment-feedback comment-feedback-rejected" role="alert">{error}</p>}
        </div>
    );
};

export default CommentCreate;
