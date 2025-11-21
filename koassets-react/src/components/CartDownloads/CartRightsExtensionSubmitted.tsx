import React from 'react';
import './CartRightsExtensionSubmitted.css';

interface CartRightsExtensionSubmittedProps {
    onContinue: () => void;
}

const CartRightsExtensionSubmitted: React.FC<CartRightsExtensionSubmittedProps> = ({ onContinue }) => {
    return (
        <div className="cart-rights-extension-submitted">
            <div className="cart-rights-extension-submitted-content">
                {/* Success Icon */}
                <div className="success-icon">
                    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="60" cy="60" r="58" stroke="#4CAF50" strokeWidth="4" fill="none"/>
                        <path d="M35 60L52 77L85 44" stroke="#4CAF50" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>

                {/* Success Heading */}
                <h2 className="success-heading">SUCCESS</h2>

                {/* Success Message */}
                <p className="success-message">
                    Thank you for your request. We are working to find the best service for you.
                </p>

                <p className="success-submessage">
                    Shortly you will find a notification in your email.
                </p>

                {/* Continue Button */}
                <button 
                    className="continue-button primary-button"
                    onClick={onContinue}
                    type="button"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

export default CartRightsExtensionSubmitted;

