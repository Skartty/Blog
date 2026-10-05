import './CommentList.css';

const CommentList = ({ comments = [] }) => {
    const approvedComments = comments.filter(comment => comment.status === 'approved');

    return (
        <div className="comment-list" aria-live="polite">
            <h4 className="comment-list-title">
                Comentários
                <span>{approvedComments.length}</span>
            </h4>
            <ul>
                {approvedComments.map(comment => (
                    <li key={comment.id}>{comment.content}</li>
                ))}
            </ul>
        </div>
    );
};

export default CommentList;
