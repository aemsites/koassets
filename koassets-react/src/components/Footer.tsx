import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-left">
                    <img src={`${import.meta.env.BASE_URL}transparent-logo.png`} alt="Logo" className="footer-logo" />
                </div>
                <div className="footer-right">
                    <p>
                        <a href="/meet-the-team" className="footer-link meet-team">
                            Meet the Team
                        </a>
                    </p>
                    <p>
                        <a href="mailto:assetmanagers@companydomain.com" className="footer-link contact-us">
                            Contact Us
                        </a>
                    </p>
                    <p>
                        <a href="/support-portal" className="footer-link support-training">
                            Support & Training
                        </a>
                    </p>
                    <p>
                        <a href="/faqs.html" className="footer-link faqs">
                            FAQs
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
