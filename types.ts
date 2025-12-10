
// types.ts

// --- User & Auth Types ---
export type SchoolUserRole = 'student' | 'teacher' | 'head_of_department' | 'canteen_seller' | 'deputy_headteacher' | 'parent' | 'old_student' | 'carrier' | 'admin' | 'admission_agent';

export interface User {
  name: string;
  studentId: string;
  class?: string;
  stream?: string;
  schoolId?: string;
  role: 'student' | 'superadmin' | SchoolUserRole;
  password?: string;
  avatarUrl?: string;
  contactNumber?: string;
  email?: string;
  bio?: string;
  mustChangePassword?: boolean;
  dateOfBirth?: string;
  address?: string;
  gender?: 'Male' | 'Female';
  shopId?: string; // For canteen_seller
  unebPassSlip?: UnebPassSlip; // To store verified results
  internalExams?: InternalExamResult[];
  accountStatus?: 'temporary' | 'active' | 'disabled';
  pendingTransferAcceptance?: boolean;
  teachingAssignments?: { [className: string]: string[] };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'headteacher' | 'uneb_admin' | 'nche_admin';
  assignedSchoolIds: string[];
  password: string;
  avatarUrl?: string;
  contactNumber?: string;
  bio?: string;
  lastLogin?: number;
  address?: string;
}


// --- School & Module Types ---
export interface School {
  id: string;
  name: string;
  address: string;
  modules: { 
    moduleId: string; 
    status: 'assigned' | 'active' | 'published';
    allowedRoles?: SchoolUserRole[];
  }[];
  isHomePagePublished?: boolean;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  isAssignable: boolean;
}

// --- Smart Admission & UNEB Types ---
export interface UnebSubjectResult {
    subjectNumber: string;
    subjectName: string;
    gradeNumber: string; // The numeric grade (e.g., '1', '3')
    gradeWord: string;   // The word grade (e.g., 'DISTINCTION', 'CREDIT')
}

export interface ExtractedUnebSlipData {
    // Slip Information
    yearOfExamination: string;
    slipSerialNumber: string;
    examinationType: string; // e.g., "UGANDA CERTIFICATE OF EDUCATION"

    // Candidate Information
    candidateName: string;
    schoolName: string;
    centerNumber: string;
    indexNumber: string;
    entryCode: string;
    dateOfBirth: string;
    schoolAddress: string;

    // Subjects Table
    subjects: UnebSubjectResult[];

    // Performance Summary
    gradeAggregate: string;
    overallResult: string;

    // Footer
    note: string;
}


export interface UnebPassSlip {
  indexNo: string;
  name: string;
  year: string;
  level: 'P.L.E' | 'U.C.E' | 'U.A.C.E';
  subjects: { name: string; grade: string }[];
  dateOfBirth?: string;
  schoolName?: string;
  schoolAddress?: string;
  entryCode?: string;
  aggregate?: string;
  result?: string;
}

export interface UnebStats {
    totalSlips: number;
    uniqueSchools: number;
    byLevel: {
        'P.L.E': { studentCount: number; years: string[] };
        'U.C.E': { studentCount: number; years: string[] };
        'U.A.C.E': { studentCount: number; years: string[] };
    };
}

export interface SchoolALevelCombination {
  id: string;
  name: string; // e.g., "PCM"
  subjects: string; // e.g., "Physics, Chemistry, Mathematics"
}

export interface ALevelCombinationSettings {
  arts: SchoolALevelCombination[];
  sciences: SchoolALevelCombination[];
}

export interface AdmissionSettings {
    schoolId: string;
    automaticAdmission: boolean;
    defaultClass: string;
    studentIdPrefix: string;
    admissionFee: number;
    acceptingClasses: string[];
    startDate: string;
    endDate: string;
    aLevelCombinations: ALevelCombinationSettings;
}

export interface CompletedAdmission {
    id: string;
    applicantId: string; // The User ID of the student who applied OR their index number if new
    data: UnebPassSlip | ExtractedUnebSlipData;
    status: 'under_review' | 'approved' | 'rejected' | 'transferred';
    timestamp: number;
    targetClass: string;
    gender?: 'Male' | 'Female';
    aLevelCombinationChoices?: string[];
    transferToSchoolId?: string;
    transferStatus?: 'pending_student_approval' | 'accepted_by_student' | 'rejected_by_student';
}

export interface StagedAdmission {
  data: UnebPassSlip | ExtractedUnebSlipData;
  targetClass: string;
  gender: 'Male' | 'Female';
  aLevelCombinationChoices: string[];
}

export interface StagedCanteenOrder {
    shopId: string;
    cart: Record<string, number>;
    deliveryMethod: 'pickup' | 'delivery';
    totalAmount: number;
}

export interface StagedMarketplaceOrder {
    cart: Record<string, number>; // listingId: quantity
    totalAmount: number;
}


// --- E-Wallet Types ---
export type TransactionType = 'top-up' | 'payment' | 'withdrawal' | 'fee_payment' | 'admission_fee_payment' | 'disbursement' | 'allowance' | 'bursary_credit' | 'service_fee_credit' | 'transfer_fee_payment';
export type TopUpMethod = 'mobile_money' | 'card' | 'bank_transfer' | 'system_credit';
export type WithdrawalMethod = 'mobile_money' | 'bank_transfer';

export interface EWallet {
  userId: string;
  balance: number;
  currency: 'UGX';
  pin?: string; // Should be hashed in a real app
}

export interface EWalletTransaction {
  id: string;
  walletUserId: string;
  type: TransactionType;
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  timestamp: number;
  recipient?: string;
  method?: TopUpMethod | 'e-wallet';
  feeId?: string;
  orderId?: string;
  negotiationId?: string;
  senderId?: string;
  senderName?: string;
}

export interface SchoolFeeItem {
  id: string;
  name: string;
  amount: number;
}

export interface SchoolFeePaymentRecord {
  transactionId: string;
  paidAt: number;
  paidAmount: number; // New field to track installment amount
}

export interface SchoolFee {
    id: string;
    schoolId: string;
    title: string;
    term: string; // e.g., "Term 1", "Term 2", "Term 3"
    year: number;
    targetClasses: string[]; // Array of class names
    baseAmount: number; // The main tuition fee
    items: SchoolFeeItem[];
    totalAmount: number; // Calculated: baseAmount + sum of items.amount
    dueDate: number;
    payments: { [studentId: string]: SchoolFeePaymentRecord[] }; // Changed to array for installments
}

export interface StagedSchoolFee {
    studentId: string;
    feeId: string;
    amountToPay: number;
}

export interface ParentalControlSettings {
    userId: string;
    dailySpendingLimit?: number;
    weeklySpendingLimit?: number;
    blockedMerchants?: string[];
}

export interface PinResetRequest {
    id: string;
    userId: string;
    userName: string;
    schoolId?: string;
    userRole: User['role'] | AdminUser['role'];
    timestamp: number;
    status: 'pending' | 'completed';
}


// --- Social Hub, Groups, Messages ---
export interface Group {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  bannerUrl?: string;
  adminId: string;
  memberIds: string[];
  settings: {
    onlyAdminsCanMessage: boolean;
  };
}

export interface GroupPost {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string; // This string will now contain rich HTML content
  timestamp: number;
  reactions: Record<string, string[]>;
  replyTo?: {
    messageId: string;
    authorName: string;
    content: string;
  };
  isDeleted?: boolean;
  views?: number;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  timestamp: number;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  content?: string;
  timestamp: number;
  expiresAt: number;
  reactions: Record<string, string[]>;
  viewedBy: string[];
}

export interface ChatConversation {
  id: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageTimestamp: number;
  lastMessageSenderId?: string;
  unreadCount: { [userId: string]: number };
}

export interface ChatAttachment {
    name: string;
    type: 'image' | 'video' | 'file';
    dataUrl: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  attachments?: ChatAttachment[];
  timestamp: number;
  isSent: boolean;
  readBy?: string[];
  reactions?: Record<string, string[]>;
  replyTo?: {
    messageId: string;
    authorName: string;
    content: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedFor?: string[];
  scheduledSendTime?: number;
}

export interface BroadcastChannel {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  adminIds: string[];
}

export interface BroadcastMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  timestamp: number;
}

// --- General & System ---
export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
}

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    userId: string;
    userName: string;
    action: string;
    details: Record<string, any>;
    ipAddress: string;
    schoolId?: string;
}

export interface ConversationEntry {
  id: number | string;
  userId: string;
  userQuery: string;
  aiResponse: string;
  timestamp: Date;
  feedback: 'up' | 'down' | null;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string;
  level: 'O-Level' | 'A-Level';
  streams: string[];
}


// --- Home Page Editor ---
export interface HomePageContent {
    schoolId: string;
    hero: {
        logoUrl: string;
        backgroundType: 'single_image' | 'slider';
        imageUrl: string;
        sliderImages: { id: string; url: string }[];
        title: string;
        subtitle: string;
        buttonText: string;
        marquee: {
            enabled: boolean;
            text: string;
        };
        headerBackgroundColor?: string;
        headerTextColor?: string;
    };
    welcome: {
        title: string;
        mainText: string;
        director: {
            imageUrl: string;
            name: string;
            title: string;
            quote: string;
        };
        coreValues: string[];
    };
    whyChooseUs: {
        title: string;
        items: { id: string; title: string; description: string }[];
    };
    campuses: {
        title: string;
        items: { id: string; imageUrl: string; name: string; description: string }[];
    };
    news: {
        title: string;
        items: { id: string; imageUrl: string; title: string; date: string; excerpt: string }[];
    };
}

// --- Smart ID Card ---
export interface CustomIdField {
    id: string;
    label: string;
    userProperty: keyof User;
}

export interface SmartIDSettings {
    schoolId: string;
    primaryColor: string;
    textColor: string;
    customFields: CustomIdField[];
    templateType: 'default' | 'custom';
}

export interface TemplateField {
  id: string;
  type: 'text' | 'photo' | 'qrcode' | 'static-text';
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
  userProperty?: keyof User;
  label?: string; // for static text or as a fallback
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  color: string;
}

export interface CustomIdTemplate {
  schoolId: string;
  frontBackground: string;
  backBackground: string;
  fields: TemplateField[];
}

// --- E-Canteen ---
export type PaymentMethod = 'e_wallet' | 'rfid' | 'nfc' | 'barcode';

export interface CanteenTable {
  id: string;
  label: string;
  capacity: number;
}

export interface CanteenTimeSlot {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export interface CanteenSeatSettings {
  totalStudents: number;
  breakfastMinutes: number;
  breakfastStartTime: string; 
  tables: CanteenTable[];
  syncWindowIds?: string[];
  timePerStudentPerSlotMinutes: number; // NEW: e.g., 15 minutes per student per seating slot
}

export interface CanteenSettings {
  schoolId: string;
  activePaymentMethod: PaymentMethod;
  seatSettings: CanteenSeatSettings;
  orderingWindows: CanteenTimeSlot[];
}

export interface CanteenMenuItem {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
}

export interface CanteenCategory {
  id: string;
  shopId: string;
  name: string;
  itemCount: number;
}

export interface CanteenShop {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  ownerId?: string; // userId of the canteen_seller
  carrierIds?: string[];
}

export type CanteenOrderStatus = 'pending' | 'preparing' | 'packaged' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface CanteenOrder {
  id: string;
  shopId: string;
  studentId: string;
  studentName: string;
  items: { itemId: string; name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: CanteenOrderStatus;
  timestamp: number;
  transactionId?: string;
  deliveryMethod: 'pickup' | 'delivery';
  assignedTable: string | null;
  assignedSlotStart: number | null;
  assignedSlotEnd: number | null;
}

export interface DecodedQrOrder {
    studentId: string;
    studentName: string; // This will be added after decoding from studentId
    shopId: string;
    totalAmount: number;
    cartItems: { itemId: string, name: string; quantity: number, price: number }[];
}

export type ReceiptStatus = 'Pending' | 'Preparing' | 'Packaged' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Completed';

export interface Receipt {
    id: string;
    transactionId: string;
    orderId?: string; // Optional, for general transactions
    userId: string; // The owner of this receipt
    buyerId?: string; // Optional
    sellerId?: string; // Optional
    timestamp: number;
    type: 'purchase' | 'sale' | 'top-up' | 'withdrawal' | 'transfer_sent' | 'transfer_received' | 'fee_payment' | 'refund' | 'deposit';
    amount: number;
    description: string;
    partyName: string; // The other person/entity in the transaction
    items?: { name: string; quantity: number; price: number }[]; // Optional
    statusHistory: { status: ReceiptStatus | string; timestamp: number }[]; // Allow string for general statuses like 'Completed'
}

export interface DeliveryNotification {
  id: string;
  orderId: string;
  studentId: string;
  studentName: string;
  shopId: string;
  tableNumber: string;
  timestamp: number;
  status: 'pending' | 'served';
}


// --- System Security ---
export interface IpWhitelistSettings {
    enabled: boolean;
    allowedIps: string[];
    vpnAllowed: boolean;
}

export interface UnebLogoSettings {
  url: string;
  size: number; // in pixels
}

// --- NCHE (Higher Education) Types ---
export interface HigherEducationInstitution {
  id: string;
  name: string;
  acronym: string;
  type: 'University' | 'Tertiary Institution' | 'Other';
  ownership: 'Public' | 'Private';
  logoUrl: string;
}

export interface ProgramRequirement {
    principalPasses: number; // e.g., 2
    subsidiaryPasses: number; // e.g., 1 from General Paper
    essentialSubjects?: { name: string; minGrade: string }[]; // e.g., { name: 'Mathematics', minGrade: 'C' }
    relevantSubjects?: { name: string; minGrade: string }[];
    desirableSubjects?: { name: string; minGrade: string }[];
    minPoints?: number;
    uceRequirements?: string; // e.g., "5 credits including English and Mathematics"
}

export interface Program {
  id: string;
  institutionId: string;
  ncheCode: string; // Official NCHE code for the program
  name: string;
  faculty: string;
  durationYears: number;
  level: 'Certificate' | 'Diploma' | 'Bachelors' | 'Masters' | 'PhD';
  requirements: ProgramRequirement;
  estimatedFees?: number;
  careerProspects?: string[];
}

export interface SubjectPerformance {
  name: string;
  score: number; // Percentage score
  grade: string;
  remarks?: string;
}

export interface InternalExamResult {
  term: string; // e.g., "Term 1, 2024"
  subjects: SubjectPerformance[];
  average: number;
  classPosition: string; // e.g., "3rd out of 45"
}

export interface ALevelCombination {
  code: string;
  name: string;
  subjects: string[];
  description: string;
  careerProspects: string[];
}

export interface OLevelGuidance {
  topSubjects: SubjectPerformance[] | { name: string; grade: string }[];
  combinationSuggestions: ALevelCombination[];
  tertiarySuggestions: Program[];
}

export interface Topic {
  id: string;
  schoolId: string;
  name: string;
  rubricId?: string; // Link to a GradingRubric
}

// --- Grading Rubric Types ---
export interface RubricLevel {
  id: string;
  name: string;
  description: string;
  points: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  levels: RubricLevel[];
}

export interface GradingRubric {
  id: string;
  schoolId: string;
  title: string;
  description?: string;
  criteria: RubricCriterion[];
}


// --- Student Transfer Marketplace ---
export interface StudentTransferProposal {
  id: string;
  proposingSchoolId: string;
  proposingSchoolName: string;
  targetSchoolId?: string; // For private, targeted proposals
  requestId?: string; // Link to the original request
  numberOfStudents: number;
  gender: 'Male' | 'Female' | 'Mixed';
  grade: string; // e.g., "FIRST GRADE", "THIRD GRADE" (Existing field)
  levelCategory: 'O-Level' | 'A-Level' | ''; // NEW: O-Level, A-Level
  className: string; // NEW: S.1, S.5
  stream?: string; // Optional stream
  description: string;
  termsAndConditions?: string; // Added field for terms and conditions
  status: 'open' | 'closed';
  timestamp: number;
  pricePerStudent: number;
  deadline: number; // timestamp
}

export interface StudentTransferRequest {
  id: string;
  requestingSchoolId: string;
  requestingSchoolName: string;
  numberOfStudents: number;
  gender: 'Male' | 'Female' | 'Mixed';
  grade: string;
  className: string;
  stream?: string;
  status: 'open' | 'closed';
  timestamp: number;
  amountPerStudent?: number;
  fulfilledStudentsCount?: number; // NEW: How many students have been successfully transferred for this request.
}


export interface NegotiationMessage {
  senderId: string; // headteacher user id or 'system'
  senderName: string;
  content: string;
  timestamp: number;
  readBy?: string[];
}

export interface TransferNegotiation {
  id: string; // proposalId_interestedSchoolId
  proposalId: string;
  proposingSchoolId: string;
  interestedSchoolId: string;
  requestId?: string; // Optional: Link to the original StudentTransferRequest if this negotiation was initiated from fulfilling a request.
  messages: NegotiationMessage[];
  status: 'active' | 'accepted' | 'payment_made' | 'completed' | 'rejected';
  lastUpdated: number;
  assignedStudents?: { studentId: string; studentName: string; indexNumber: string; }[];
  
  // New fields for detailed negotiation
  isNegotiable?: boolean;
  buyerOffer?: number;
  isBuyerOfferActive?: boolean;
  sellerOffer?: number;
  finalPrice?: number;
}


export interface Place {
  title: string;
  uri: string;
}


export interface MarketplaceMedia {
    type: 'image' | 'video';
    url: string;
}

export interface MarketplaceListing {
    id: string;
    sellerId: string;
    sellerName: string;
    sellerAvatar?: string;
    title: string;
    description: string;
    price: number;
    category: 'Electronics' | 'Clothing' | 'Books' | 'Furniture' | 'Services' | 'Other';
    condition: 'new' | 'used';
    location: string;
    media: MarketplaceMedia[];
    createdAt: number;
    status: 'available' | 'sold' | 'pending';
    availableUnits: number;
}

export interface Event {
    id: string;
    schoolId: string;
    createdBy: string; // userId of creator
    title: string;
    description: string;
    startTime: number; // timestamp
    endTime: number; // timestamp
    bannerUrl: string;
    logoUrl: string;
    place: Place;
    createdAt: number;
    attachments?: ChatAttachment[];
}


// --- E-Vote Module ---
export interface ElectionSettings {
  schoolId: string;
  startTime: number; // timestamp
  endTime: number; // timestamp
  isVotingOpen: boolean;
}

export interface VotingCategory {
  id: string;
  schoolId: string;
  title: string;
  order: number;
}

export interface Contestant {
  id: string;
  schoolId: string;
  categoryId: string;
  name: string;
  nickname?: string;
  avatarUrl?: string;
  class: string;
  manifesto: string;
  votes: number;
}

export interface VoteRecord {
  studentId: string;
  schoolId: string;
  timestamp: number;
  choices: Record<string, string>; // { [categoryId]: contestantId }
}

export interface DraftVoteRecord {
  studentId: string;
  schoolId: string;
  choices: Record<string, string>; // { [categoryId]: contestantId }
}

// --- My Institute Module Types ---

export interface University {
    id: string;
    name: string;
    shortName: string;
    category: 'Public' | 'Private' | 'Technical' | 'Vocational';
    logoUrl: string;
    location: string;
    description: string;
    website: string;
    contactEmail: string;
    contactPhone: string;
    createdAt: number;
}

export interface Faculty {
    id: string;
    universityId: string;
    name: string;
    description: string;
}

export interface Course {
    id: string;
    facultyId: string;
    courseName: string;
    courseCode: string;
    duration: string;
    award: 'Bachelor' | 'Diploma' | 'Certificate';
    description: string;
    careerPaths: string[];
    createdAt: number;
    tuitionFee?: number;
}

export interface MiSubject {
    id: string;
    name: string;
    level: 'O-Level' | 'A-Level' | 'Both';
    description: string;
    importanceNotes: string;
}

export interface CourseRequirement {
    id: string;
    courseId: string;
    subjectId: string;
    requirementType: 'Essential' | 'Relevant' | 'Desirable';
    minimumGrade: string;
}

export interface SubjectCombination {
    id: string;
    combinationName: string; // e.g. "PCM"
    subjectIds: string[];
    description: string;
}

export interface CombinationQualification {
    id: string;
    combinationId: string;
    courseId: string;
    weight: number;
    notes: string;
}

export interface Career {
    id: string;
    careerName: string;
    description: string;
    relatedCourses: string[]; // Course IDs
    keySubjects: string[]; // Subject IDs
}

// --- Visitor Center Module Types ---
export interface Visitor {
    id: string;
    schoolId: string;
    name: string;
    idNumber: string;
    idPhotoUrl: string;
    reasonForVisit: string;
    signInTime: number;
    signOutTime: number | null;
    appointmentId?: string; // Link to a confirmed appointment
    appointmentStatus?: string;
    meetingWithUserId?: string;
    meetingWithUserName?: string;
    matchConfidence?: 'High' | 'Medium' | 'Low'; // AI Face Match Confidence
    isVerifiedMatch?: boolean; // True if AI confirms faces match
}

export enum AppointmentStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    REJECTED = 'rejected',
    CHECKED_IN = 'checked_in',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export interface Appointment {
    id: string;
    schoolId: string;
    hostUserId: string; // The user (student/teacher/admin) being visited
    hostName: string;
    hostRole: string;
    visitorName: string;
    visitorIdNumber?: string; // Optional, for better matching
    reason: string;
    scheduledTime: number; // Timestamp
    status: AppointmentStatus;
    createdAt: number;
    createdBy: string; // User ID of creator (usually student)
}

// --- Kiosk Log Types ---
export interface KioskLogEntry {
    id: string;
    schoolId: string;
    type: 'voting' | 'canteen' | 'visitor';
    timestamp: number;
    description: string;
    details?: any;
    userId?: string;
    userName?: string;
}
