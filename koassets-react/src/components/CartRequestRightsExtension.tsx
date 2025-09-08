import { CalendarDate } from '@internationalized/date';
import React, { useCallback, useState } from 'react';
import type { CartRequestRightsExtensionProps, RequestRightsExtensionStepData } from '../types';
import './CartRequestRightsExtension.css';
import MyDatePicker from './MyDatePicker';
import ThumbnailImage from './ThumbnailImage';

const CartRequestRightsExtension: React.FC<CartRequestRightsExtensionProps> = ({
    restrictedAssets,
    intendedUse,
    onCancel,
    onSendRightsExtensionRequest,
    onBack,
    initialData
}) => {
    // Form state
    const [agencyType, setAgencyType] = useState<string>(initialData?.agencyType ?? 'TCCC Associate');
    const [agencyName, setAgencyName] = useState<string>(initialData?.agencyName ?? '');
    const [contactName, setContactName] = useState<string>(initialData?.contactName ?? '');
    const [contactEmail, setContactEmail] = useState<string>(initialData?.contactEmail ?? '');
    const [contactPhone, setContactPhone] = useState<string>(initialData?.contactPhone ?? '');
    const [materialsRequiredDate, setMaterialsRequiredDate] = useState<CalendarDate | null>(initialData?.materialsRequiredDate ?? null);
    const [formatsRequired, setFormatsRequired] = useState<string>(initialData?.formatsRequired ?? '');
    const [usageRightsRequired, setUsageRightsRequired] = useState(initialData?.usageRightsRequired ?? {
        music: false,
        talent: false,
        photographer: false,
        voiceover: false,
        stockFootage: false
    });
    const [adaptationIntention, setAdaptationIntention] = useState<string>(initialData?.adaptationIntention ?? '');
    const [budgetForMarket, setBudgetForMarket] = useState<string>(initialData?.budgetForMarket ?? '');
    const [exceptionOrNotes, setExceptionOrNotes] = useState<string>(initialData?.exceptionOrNotes ?? '');
    const [agreesToTerms, setAgreesToTerms] = useState<boolean>(initialData?.agreesToTerms ?? false);

    // Contact search state (for future implementation)
    const [contactSearchTerm, setContactSearchTerm] = useState<string>('');
    const [showContactResults, setShowContactResults] = useState<boolean>(false);

    // Format date helper
    const formatDate = (dateInput: CalendarDate | number | null | undefined): string => {
        if (!dateInput) return '';

        let date: Date;
        if (typeof dateInput === 'number') {
            date = new Date(dateInput);
        } else {
            // CalendarDate
            date = new Date(dateInput.year, dateInput.month - 1, dateInput.day);
        }

        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
    };

    // Helper function to get current step data
    const getCurrentStepData = useCallback((): RequestRightsExtensionStepData => ({
        restrictedAssets,
        agencyType,
        agencyName,
        contactName,
        contactEmail,
        contactPhone,
        materialsRequiredDate,
        formatsRequired,
        usageRightsRequired,
        adaptationIntention,
        budgetForMarket,
        exceptionOrNotes,
        agreesToTerms
    }), [restrictedAssets,
        agencyType, agencyName, contactName, contactEmail, contactPhone,
        materialsRequiredDate, formatsRequired, usageRightsRequired,
        adaptationIntention, budgetForMarket, exceptionOrNotes, agreesToTerms
    ]);

    // Form validation - only validate fields marked as required
    const isFormValid = useCallback(() => {
        const requiredFields = [
            agencyName.trim(),
            contactName.trim(),
            contactEmail.trim(),
            adaptationIntention.trim(),
            budgetForMarket.trim()
        ];

        // Check if all required fields are filled
        return requiredFields.every(field => field.length > 0);
    }, [
        agencyName, contactName, contactEmail, adaptationIntention, budgetForMarket
    ]);

    // Handle usage rights checkbox change
    const handleUsageRightChange = useCallback((rightType: keyof typeof usageRightsRequired, checked: boolean) => {
        setUsageRightsRequired(prev => ({
            ...prev,
            [rightType]: checked
        }));
    }, []);

    // Handle contact search (placeholder for future implementation)
    const handleContactSearch = useCallback((searchTerm: string) => {
        setContactSearchTerm(searchTerm);
        // TODO: Implement contact search API call
        setShowContactResults(searchTerm.length > 2);
    }, []);

    // Handle send request
    const handleSendRightsExtensionRequest = useCallback(() => {
        if (isFormValid() && agreesToTerms) {
            onSendRightsExtensionRequest(getCurrentStepData());
        }
    }, [isFormValid, agreesToTerms, onSendRightsExtensionRequest, getCurrentStepData]);

    return (
        <div className="cart-request-rights-extension">
            <div className="cart-request-rights-extension-content">
                {/* Asset List Column */}
                <div className="cart-request-rights-extension-assets">
                    <h3>Assets</h3>

                    {/* Intended Use Summary */}
                    <div className="intended-use-section">
                        <h4>Intended Use</h4>
                        <div className="intended-use-grid">
                            <div className="intended-use-item">
                                <label>INTENDED AIR DATE</label>
                                <div>{formatDate(intendedUse.airDate)}</div>
                            </div>
                            <div className="intended-use-item">
                                <label>INTENDED PULL DATE</label>
                                <div>{formatDate(intendedUse.pullDate)}</div>
                            </div>
                            <div className="intended-use-item">
                                <label>INTENDED MARKETS</label>
                                <div>{intendedUse.markets.map(c => c.name).join(', ')}</div>
                            </div>
                            <div className="intended-use-item">
                                <label>INTENDED MEDIA</label>
                                <div>{intendedUse.mediaChannels.map(c => c.name).join(', ')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Asset List */}
                    <div className="asset-list-items">
                        {restrictedAssets.map((asset) => (
                            <div key={asset.assetId} className="asset-list-item">
                                <div className="asset-thumbnail">
                                    <ThumbnailImage item={asset} />
                                </div>
                                <div className="asset-details">
                                    <div className="asset-title">{asset.title || asset.name}</div>
                                    <div className="asset-type">TYPE: {asset.formatLabel?.toUpperCase()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rights Extension Request Form Column */}
                <div className="cart-request-rights-extension-form">
                    <div className="cart-request-rights-extension-form-content">
                        <h3>Rights Extension Request</h3>

                        {/* Agency Information */}
                        <div className="form-field">
                            <label>
                                Are you with an agency, or a TCCC Associate? Please note all TCCC Associates will have an @coca-cola email address.
                            </label>
                            <select
                                className="form-select"
                                value={agencyType}
                                onChange={(e) => setAgencyType(e.target.value)}
                            >
                                <option value="TCCC Associate">TCCC Associate</option>
                                <option value="Agency">Agency</option>
                            </select>
                        </div>

                        {/* Agency Name */}
                        <div className="form-field">
                            <label>
                                Agency Name <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={agencyName}
                                onChange={(e) => setAgencyName(e.target.value)}
                                placeholder="Enter agency name"
                            />
                        </div>

                        {/* Contact Information */}
                        <div className="form-field">
                            <label>
                                Name of Agency Contact <span className="required">*</span>
                            </label>
                            <div className="contact-search">
                                <input
                                    type="text"
                                    className="form-input"
                                    value={contactName}
                                    onChange={(e) => {
                                        setContactName(e.target.value);
                                        handleContactSearch(e.target.value);
                                    }}
                                    placeholder="Type a name..."
                                />
                                {showContactResults && contactSearchTerm.length > 2 && (
                                    <div className="contact-search-results">
                                        <div className="contact-search-item">No contacts found</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-field">
                            <label>
                                Email Address of Agency Contact <span className="required">*</span>
                            </label>
                            <input
                                type="email"
                                className="form-input"
                                value={contactEmail}
                                onChange={(e) => setContactEmail(e.target.value)}
                                placeholder="Enter email address"
                            />
                        </div>

                        <div className="form-field">
                            <label>
                                Phone Number of Agency Contact
                            </label>
                            <input
                                type="tel"
                                className="form-input"
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                                placeholder="Enter phone number"
                            />
                        </div>

                        {/* Materials Information */}
                        <div className="form-field">
                            <label>
                                Materials Needed
                            </label>
                        </div>

                        <div className="form-field">
                            <label>
                                Materials required by
                            </label>
                            <MyDatePicker
                                value={materialsRequiredDate}
                                onChange={setMaterialsRequiredDate}
                                showClearButton={!!materialsRequiredDate}
                                onClear={() => setMaterialsRequiredDate(null)}
                                aria-label="Select materials required date"
                            />
                        </div>

                        <div className="form-field">
                            <label>
                                Formats Required
                            </label>
                            <textarea
                                className="form-textarea"
                                value={formatsRequired}
                                onChange={(e) => setFormatsRequired(e.target.value)}
                                placeholder="Describe the formats required"
                            />
                        </div>

                        {/* Usage Rights Required */}
                        <div className="form-field">
                            <label>
                                Usage Rights Required
                            </label>
                            <div className="usage-rights-grid">
                                <div className="usage-right-item">
                                    <input
                                        type="checkbox"
                                        id="music"
                                        checked={usageRightsRequired.music}
                                        onChange={(e) => handleUsageRightChange('music', e.target.checked)}
                                    />
                                    <label htmlFor="music">Music</label>
                                </div>
                                <div className="usage-right-item">
                                    <input
                                        type="checkbox"
                                        id="talent"
                                        checked={usageRightsRequired.talent}
                                        onChange={(e) => handleUsageRightChange('talent', e.target.checked)}
                                    />
                                    <label htmlFor="talent">Talent</label>
                                </div>
                                <div className="usage-right-item">
                                    <input
                                        type="checkbox"
                                        id="photographer"
                                        checked={usageRightsRequired.photographer}
                                        onChange={(e) => handleUsageRightChange('photographer', e.target.checked)}
                                    />
                                    <label htmlFor="photographer">Photographer</label>
                                </div>
                                <div className="usage-right-item">
                                    <input
                                        type="checkbox"
                                        id="voiceover"
                                        checked={usageRightsRequired.voiceover}
                                        onChange={(e) => handleUsageRightChange('voiceover', e.target.checked)}
                                    />
                                    <label htmlFor="voiceover">Voiceover</label>
                                </div>
                                <div className="usage-right-item">
                                    <input
                                        type="checkbox"
                                        id="stockFootage"
                                        checked={usageRightsRequired.stockFootage}
                                        onChange={(e) => handleUsageRightChange('stockFootage', e.target.checked)}
                                    />
                                    <label htmlFor="stockFootage">Stock Footage</label>
                                </div>
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div className="form-field">
                            <label>
                                How do you intend to adapt these materials? <span className="required">*</span>
                            </label>
                            <textarea
                                className="form-textarea"
                                value={adaptationIntention}
                                onChange={(e) => setAdaptationIntention(e.target.value)}
                                placeholder="Describe how you intend to adapt these materials"
                            />
                        </div>

                        <div className="form-field">
                            <label>
                                Budget For market <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={budgetForMarket}
                                onChange={(e) => setBudgetForMarket(e.target.value)}
                                placeholder="Enter budget for market"
                            />
                        </div>

                        <div className="form-field">
                            <label>
                                Exception or Notes
                            </label>
                            <textarea
                                className="form-textarea"
                                value={exceptionOrNotes}
                                onChange={(e) => setExceptionOrNotes(e.target.value)}
                                placeholder="Any additional notes or exceptions"
                            />
                        </div>

                        {/* Terms Agreement */}
                        <div className="terms-agreement">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={agreesToTerms}
                                    onChange={(e) => setAgreesToTerms(e.target.checked)}
                                />
                                I agree to the{' '}
                                <a href="#" className="terms-link" onClick={(e) => e.preventDefault()}>
                                    terms and conditions
                                </a>{' '}
                                of use.
                            </label>
                        </div>
                    </div>

                    {/* Action Buttons - Outside scrolling area */}
                    <div className="form-actions">
                        <button
                            className="back-btn secondary-button"
                            onClick={() => onBack(getCurrentStepData())}
                            type="button"
                        >
                            Back
                        </button>

                        <div className="form-actions-right">
                            <button
                                className="cancel-btn secondary-button"
                                onClick={onCancel}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="send-request-btn primary-button"
                                onClick={handleSendRightsExtensionRequest}
                                disabled={!isFormValid() || !agreesToTerms}
                                type="button"
                            >
                                Send Request
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartRequestRightsExtension;
