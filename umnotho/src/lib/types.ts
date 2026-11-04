export type ListingType = 'goods' | 'service';

export type VoteType = 'up' | 'down';
export type VoteMap = Record<string, VoteType>;

export interface Inquiry {
  senderId: string;
  senderName: string;
  message: string;
  createdAt: Date | null;
}

export interface BarterItem {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  description: string;
  estimatedValue: number;
  city: string;
  type: ListingType;
  isBusinessBid: boolean;
  inquiries: Inquiry[];
  votes: VoteMap;
  createdAt: Date | null;
}

export type BidStatus = 'Pending' | 'In Negotiation' | 'Completed' | 'Declined';
export type BidRole = 'owner' | 'bidder';

export interface BidMessage {
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Date | null;
}

export interface Bid {
  id: string;
  itemId: string;
  itemName: string;
  itemDescription: string;
  itemValue: number;
  city: string;
  type: ListingType;
  isBusinessBid: boolean;
  ownerId: string;
  ownerName: string;
  bidderId: string;
  bidderName: string;
  offer: string;
  status: BidStatus;
  messages: BidMessage[];
  createdAt: Date | null;
  lastUpdated: Date | null;
}
