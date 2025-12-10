
import React from 'react';
import { Place } from '../types';

interface MapViewProps {
    place?: Place;
    query?: string;
    className?: string;
}

const MapView: React.FC<MapViewProps> = ({ place, query, className = "" }) => {
    let mapQuery = "";

    if (place) {
        // Attempt to extract query from URI if it exists, otherwise fallback to title
        try {
             const urlObj = new URL(place.uri);
             const q = urlObj.searchParams.get('query');
             if (q) {
                 mapQuery = q;
             } else {
                 mapQuery = place.title;
             }
        } catch (e) {
            mapQuery = place.title;
        }
    } else if (query) {
        mapQuery = query;
    }

    if (!mapQuery) {
        return (
            <div className={`flex items-center justify-center bg-gray-700 text-gray-400 ${className}`}>
                <p className="p-4 text-center">No location data available</p>
            </div>
        );
    }

    const embedUrl = `https://www.google.com/maps?output=embed&q=${encodeURIComponent(mapQuery)}`;

    return (
        <div className={`overflow-hidden rounded-lg bg-gray-800 relative shadow-inner ${className}`}>
             <iframe
                title={`Map of ${mapQuery}`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                src={embedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
            />
        </div>
    );
};

export default MapView;
