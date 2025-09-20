import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useState } from 'react';
import { FadelClient, type RightsAttribute } from '../clients/fadel-client';
import type { RightsData } from '../types';

interface MediaChannelsProps {
    selectedMediaChannels: Set<RightsData>;
    setSelectedMediaChannels: React.Dispatch<React.SetStateAction<Set<RightsData>>>;
}

const MediaChannels: React.FC<MediaChannelsProps> = ({
    selectedMediaChannels,
    setSelectedMediaChannels
}) => {
    // Internal state for media channels data
    const [mediaChannelsData, setMediaChannelsData] = useState<RightsData[]>([]);
    const [isLoadingMediaChannels, setIsLoadingMediaChannels] = useState<boolean>(false);
    const [mediaChannelsError, setMediaChannelsError] = useState<string>('');
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

    // Transform RightsAttribute[] to RightsData[]
    const transformRightsAttributesToRightsData = useCallback((rightsAttributes: RightsAttribute[]): RightsData[] => {
        if (!rightsAttributes || rightsAttributes.length === 0) {
            return [];
        }

        const rootAttribute = rightsAttributes[0]; // The root "All" element

        const transformAttribute = (attr: RightsAttribute): RightsData => ({
            id: attr.id,
            rightId: attr.right.rightId,
            name: attr.right.description,
            enabled: attr.enabled,
            children: attr.childrenLst?.map(transformAttribute) || []
        });

        // First element is "All" from the root
        const allElement: RightsData = {
            id: rootAttribute.id,
            rightId: rootAttribute.right.rightId,
            name: rootAttribute.right.description,
            enabled: rootAttribute.enabled,
            children: []
        };

        // Other elements are from root's childrenLst
        const childElements = rootAttribute.childrenLst?.map(transformAttribute) || [];

        return [allElement, ...childElements];
    }, []);

    // Fetch media channels data
    const fetchMediaChannelsData = useCallback(async () => {
        if (isDataLoaded) {
            return; // Already loaded, no need to fetch again
        }

        setIsLoadingMediaChannels(true);
        setMediaChannelsError('');

        try {
            const fadelClient = FadelClient.getInstance();
            const mediaRightsResponse = await fadelClient.fetchMediaRights();

            const transformedData = transformRightsAttributesToRightsData(mediaRightsResponse.attribute);
            setMediaChannelsData(transformedData);
            setIsDataLoaded(true);
        } catch (error) {
            console.error('Failed to fetch media channels data:', error);
            setMediaChannelsError('Failed to load media channels');
            ToastQueue.negative('Failed to fetch Media Channels Data', { timeout: 2000 });

            // Set empty data but mark as loaded to prevent infinite retries
            setMediaChannelsData([]);
            setIsDataLoaded(true);
        } finally {
            setIsLoadingMediaChannels(false);
        }
    }, [isDataLoaded, transformRightsAttributesToRightsData]);

    // Fetch data when component mounts
    useEffect(() => {
        if (!isDataLoaded) {
            fetchMediaChannelsData();
        }
    }, [fetchMediaChannelsData, isDataLoaded]);
    // Get the "All" option for media channels (first item in the list)
    const getAllMediaChannelOption = useCallback(() => {
        return mediaChannelsData.length > 0 ? mediaChannelsData[0] : null;
    }, [mediaChannelsData]);

    // Helper function to check if "All" is selected
    const isAllMediaChannelsSelected = useCallback(() => {
        const allOption = getAllMediaChannelOption();
        return allOption ? Array.from(selectedMediaChannels).some(c => c.rightId === allOption.rightId) : false;
    }, [selectedMediaChannels, getAllMediaChannelOption]);

    const handleMediaChannelToggle = useCallback((channel: RightsData) => {
        // Don't allow toggling disabled items
        if (!channel.enabled) {
            return;
        }

        const allOption = getAllMediaChannelOption();
        setSelectedMediaChannels((prev: Set<RightsData>) => {
            const newSet = new Set(prev);

            if (allOption && channel.rightId === allOption.rightId) {
                // If selecting 'All', clear everything and only keep 'All'
                const hasAllOption = Array.from(newSet).some(c => c.rightId === allOption.rightId);
                if (hasAllOption) {
                    // Remove all option
                    newSet.forEach(c => {
                        if (c.rightId === allOption.rightId) {
                            newSet.delete(c);
                        }
                    });
                } else {
                    newSet.clear();
                    newSet.add(allOption);
                }
            } else {
                // If selecting any other media channel, remove 'All' if it's selected
                if (allOption) {
                    newSet.forEach(c => {
                        if (c.rightId === allOption.rightId) {
                            newSet.delete(c);
                        }
                    });
                }

                // Toggle the selected channel
                const existingChannel = Array.from(newSet).find(c => c.rightId === channel.rightId);
                if (existingChannel) {
                    newSet.delete(existingChannel);
                } else {
                    newSet.add(channel);
                }
            }

            return newSet;
        });
    }, [getAllMediaChannelOption, setSelectedMediaChannels]);
    return (
        <div className="media-channels-list">
            {isLoadingMediaChannels ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <span>Loading media channels...</span>
                </div>
            ) : mediaChannelsError ? (
                <div className="error-message">{mediaChannelsError}</div>
            ) : (
                mediaChannelsData.map((channel, index) => (
                    <React.Fragment key={channel.rightId}>
                        <label className={`checkbox-label ${!channel.enabled ? 'disabled' : ''}`}>
                            <input
                                type="checkbox"
                                checked={Array.from(selectedMediaChannels).some(c => c.rightId === channel.rightId)}
                                disabled={!channel.enabled || (() => {
                                    const allOption = getAllMediaChannelOption();
                                    return Boolean(allOption && channel.rightId !== allOption.rightId && isAllMediaChannelsSelected());
                                })()}
                                onChange={() => handleMediaChannelToggle(channel)}
                            />
                            {channel.name}
                        </label>
                        {index === 0 && <div className="horizontal-separator" />}
                    </React.Fragment>
                ))
            )}
        </div>
    );
};

export default MediaChannels;
