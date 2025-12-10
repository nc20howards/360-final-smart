
// services/marketplaceService.ts
import { MarketplaceListing, StagedMarketplaceOrder } from '../types';
import { logAction } from './auditLogService';

const LISTINGS_KEY = '360_smart_school_marketplace_listings';
const STAGED_MARKETPLACE_ORDER_KEY = '360_smart_school_staged_marketplace_order';

export const getListings = (): MarketplaceListing[] => {
    const data = localStorage.getItem(LISTINGS_KEY);
    // Sort by creation date, newest first
    return data ? JSON.parse(data).sort((a: MarketplaceListing, b: MarketplaceListing) => b.createdAt - a.createdAt) : [];
};

const saveListings = (listings: MarketplaceListing[]) => {
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
};

export const getListingById = (listingId: string): MarketplaceListing | null => {
    const listings = getListings();
    return listings.find(l => l.id === listingId) || null;
};

export const createListing = (data: Omit<MarketplaceListing, 'id' | 'createdAt'>): MarketplaceListing => {
    const listings = getListings();
    const newListing: MarketplaceListing = {
        ...data,
        id: `listing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: Date.now(),
    };
    // Use unshift to add to the beginning so it appears first
    listings.unshift(newListing);
    saveListings(listings);
    logAction(data.sellerId, data.sellerName, 'MARKETPLACE_LISTING_CREATE', { title: data.title, price: data.price });
    return newListing;
};

export const updateListing = (listingId: string, data: Partial<Omit<MarketplaceListing, 'id' | 'sellerId' | 'createdAt' | 'sellerName' | 'sellerAvatar'>>): MarketplaceListing => {
    const listings = getListings();
    const index = listings.findIndex(l => l.id === listingId);
    if (index === -1) throw new Error("Listing not found.");
    listings[index] = { ...listings[index], ...data };
    saveListings(listings);
    return listings[index];
};

export const deleteListing = (listingId: string): void => {
    const listings = getListings();
    const filtered = listings.filter(l => l.id !== listingId);
    saveListings(filtered);
};

export const purchaseListingItems = (items: { listingId: string; quantity: number }[]): void => {
    const listings = getListings();
    let updated = false;

    for (const item of items) {
        const index = listings.findIndex(l => l.id === item.listingId);
        if (index > -1) {
            const newUnits = listings[index].availableUnits - item.quantity;
            listings[index].availableUnits = Math.max(0, newUnits); // Ensure it doesn't go negative
            
            // Optionally update status if stock is depleted
            if (listings[index].availableUnits === 0) {
                listings[index].status = 'sold';
            }
            updated = true;
        } else {
            console.warn(`Could not find listing with ID ${item.listingId} to update stock.`);
        }
    }

    if (updated) {
        saveListings(listings);
    }
};

// --- Staged Order Management for Insufficient Funds ---
export const stageMarketplaceOrder = (orderData: StagedMarketplaceOrder): void => {
    localStorage.setItem(STAGED_MARKETPLACE_ORDER_KEY, JSON.stringify(orderData));
};

export const getStagedMarketplaceOrder = (): StagedMarketplaceOrder | null => {
    const data = localStorage.getItem(STAGED_MARKETPLACE_ORDER_KEY);
    return data ? JSON.parse(data) : null;
};

export const clearStagedMarketplaceOrder = (): void => {
    localStorage.removeItem(STAGED_MARKETPLACE_ORDER_KEY);
};
