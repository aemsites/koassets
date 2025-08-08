import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-left">
                    <img src="transparent-logo.png" alt="Coca-Cola Logo" className="footer-logo" />
                </div>
                <div className="footer-right">
                    <p>
                        <a href="https://assets.coke.com/content/share/us/en/help/meet-the-team.html" className="footer-link meet-team">
                            Meet the Team
                        </a>
                    </p>
                    <p>
                        <a href="mailto:assetmanagers@coca-cola.com" className="footer-link contact-us">
                            Contact Us
                        </a>
                    </p>
                    <p>
                        <a href="https://assets.coke.com/content/share/us/en/help/support-portal.html" className="footer-link support-training">
                            Support & Training
                        </a>
                    </p>
                    <p>
                        <a href="https://assets.coke.com/content/share/us/en/help/faqs.html" className="footer-link faqs">
                            FAQs
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer; 