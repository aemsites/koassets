import React from 'react';
import type { QueryProps } from '../types';
import { markdownToHtml, prettyPrintJSON } from '../utils/formatters';

const Query: React.FC<QueryProps> = ({ query }) => {
    // Format query text
    const formatQueryText = (text: string): React.JSX.Element => {
        try {
            // Check if the query is JSON
            const jsonObj = JSON.parse(text);
            return <div dangerouslySetInnerHTML={{ __html: prettyPrintJSON(jsonObj) }} />;
        } catch {
            // If not JSON, display as plain text with markdown
            return <div dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }} />;
        }
    };

    return (
        <div className={`query-container ${query.type}-query`}>
            <span className="query">
                {query.sender && <span className="sender">{query.sender}: </span>}
                {formatQueryText(query.text)}
            </span>
        </div>
    );
};

export default Query; 