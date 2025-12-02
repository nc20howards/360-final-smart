import React, { useState, useRef } from 'react';

type Diagram = 'blueprint' | 'erd' | 'usecase' | 'readme' | 'report';

const ProjectPlanView: React.FC = () => {
    const [activeDiagram, setActiveDiagram] = useState<Diagram>('blueprint');
    const blueprintRef = useRef<HTMLDivElement>(null);
    const erdRef = useRef<HTMLDivElement>(null);
    const usecaseRef = useRef<HTMLDivElement>(null);
    const readmeRef = useRef<HTMLDivElement>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    const handleDownload = (sectionRef: React.RefObject<HTMLDivElement>) => {
        if (!sectionRef.current) return;

        // Clone the node to avoid manipulating the live DOM and to make changes safely
        const clonedNode = sectionRef.current.cloneNode(true) as HTMLElement;
        
        // The README and Report sections use 'prose-invert' for dark mode text.
        // We need to remove it for printing on a white background.
        clonedNode.querySelectorAll('.prose-invert').forEach(el => {
            el.classList.remove('prose-invert');
        });
        
        const printContent = clonedNode.innerHTML;
        const printWindow = window.open('', '_blank', 'height=600,width=800');
        
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>
                            body { font-family: sans-serif; }
                            .no-print { display: none !important; }
                            /* Ensure prose text is dark for printing */
                            .prose { color: #1f2937; } 
                        </style>
                    </head>
                    <body class="p-8">
                        ${printContent}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 1000); // Increased timeout for Tailwind CDN to load in the new window
        } else {
            alert('Please allow pop-ups for this website to print the document.');
        }
    };
    
    const tabs: { id: Diagram; label: string; ref: React.RefObject<HTMLDivElement> }[] = [
        { id: 'blueprint', label: 'Blueprint', ref: blueprintRef },
        { id: 'erd', label: 'ERD', ref: erdRef },
        { id: 'usecase', label: 'Use Cases', ref: usecaseRef },
        { id: 'readme', label: 'README', ref: readmeRef },
        { id: 'report', label: 'System Report', ref: reportRef },
    ];

    const renderBlueprint = () => (
        <div ref={blueprintRef} className="printable-section bg-gray-800 p-6 rounded-lg text-white">
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-bold">Application Blueprint</h3>
                <button onClick={() => handleDownload(blueprintRef)} className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700">Download PDF</button>
            </div>
            <div className="space-y-6 text-sm text-gray-300">
                <p>This diagram outlines the high-level architecture of the 360 Smart School application.</p>
                <div className="flex flex-col md:flex-row gap-4 text-center">
                    {/* Frontend */}
                    <div className="flex-1 bg-gray-700 p-4 rounded-lg border border-cyan-500">
                        <h4 className="font-bold text-lg text-cyan-400 mb-2">Frontend</h4>
                        <p className="font-semibold">React, TypeScript, Tailwind CSS</p>
                        <div className="mt-2 p-2 bg-gray-800 rounded">`App.tsx` (Routing & State)</div>
                        <div className="mt-1 p-2 bg-gray-800 rounded">Page Components (`StudentPage`, etc.)</div>
                        <div className="mt-1 p-2 bg-gray-800 rounded">Feature Components (`Chat`, `EWallet`)</div>
                    </div>
                    {/* Services */}
                    <div className="flex-1 bg-gray-700 p-4 rounded-lg border border-indigo-500">
                        <h4 className="font-bold text-lg text-indigo-400 mb-2">Services Layer</h4>
                        <p className="font-semibold">TypeScript Modules</p>
                        <div className="mt-2 p-2 bg-gray-800 rounded">`authService` (Login, Session)</div>
                        <div className="mt-1 p-2 bg-gray-800 rounded">`*Service` (Data Logic for Features)</div>
                        <div className="mt-1 p-2 bg-gray-800 rounded">`apiService` (Gemini AI Integration)</div>
                        <div className="mt-1 p-2 bg-gray-800 rounded">`dbService` (IndexedDB Wrapper)</div>
                    </div>
                    {/* Data Persistence */}
                    <div className="flex-1 bg-gray-700 p-4 rounded-lg border border-emerald-500">
                        <h4 className="font-bold text-lg text-emerald-400 mb-2">Data Persistence (Browser)</h4>
                        <p className="font-semibold">Mock Backend</p>
                        <div className="mt-2 p-2 bg-gray-800 rounded">`localStorage` (Users, Schools, Settings)</div>
                        <div className="mt-1 p-2 bg-gray-800 rounded">`IndexedDB` (Chat History)</div>
                    </div>
                </div>
            </div>
        </div>
    );
    
    const renderErd = () => (
        <div ref={erdRef} className="printable-section bg-gray-800 p-6 rounded-lg text-white">
             <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-bold">Entity-Relationship Diagram (Simplified)</h3>
                <button onClick={() => handleDownload(erdRef)} className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700">Download PDF</button>
            </div>
             <p className="text-sm text-gray-300 mb-4">Shows the main data entities and their relationships.</p>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {['School', 'User', 'AdminUser', 'Module', 'EWallet', 'Transaction', 'Group', 'Post', 'CanteenShop', 'CanteenOrder'].map(entity => (
                    <div key={entity} className="bg-gray-700 p-3 rounded-md text-center font-semibold">{entity}</div>
                 ))}
             </div>
             <div className="mt-6 space-y-2 text-sm">
                <p><strong>- School (1)</strong> has many <strong>(M) Users</strong></p>
                <p><strong>- School (1)</strong> is managed by one <strong>(1) AdminUser (Headteacher)</strong></p>
                <p><strong>- School (M)</strong> has many <strong>(M) Modules</strong> (via assignments)</p>
                <p><strong>- User (1)</strong> has one <strong>(1) EWallet</strong></p>
                <p><strong>- EWallet (1)</strong> has many <strong>(M) Transactions</strong></p>
                <p><strong>- Group (1)</strong> has many <strong>(M) Posts</strong></p>
                <p><strong>- CanteenShop (1)</strong> has many <strong>(M) CanteenOrders</strong></p>
             </div>
        </div>
    );

    const renderUsecase = () => (
        <div ref={usecaseRef} className="printable-section bg-gray-800 p-6 rounded-lg text-white">
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-bold">Use Case Diagram</h3>
                <button onClick={() => handleDownload(usecaseRef)} className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700">Download PDF</button>
            </div>
            <p className="text-sm text-gray-300 mb-4">Describes the main actors and the actions they can perform.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold text-lg text-cyan-400 mb-2">Superadmin</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Manage Schools (Create, Edit, Delete)</li>
                        <li>Manage Admin Users (Create, Edit, Delete)</li>
                        <li>Manage System Modules</li>
                        <li>Oversee System-wide Settings (e.g., UNEB fees)</li>
                    </ul>
                </div>
                 <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold text-lg text-cyan-400 mb-2">Headteacher</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Manage School-specific Modules</li>
                        <li>Manage Students and Staff for their school</li>
                        <li>Manage E-Canteen and Admissions</li>
                        <li>View School-wide Reports & Analytics</li>
                    </ul>
                </div>
                 <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold text-lg text-cyan-400 mb-2">Teacher</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Upload Student Results</li>
                        <li>Manage Term Topics for Exploration</li>
                        <li>Send Announcements to students</li>
                    </ul>
                </div>
                 <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold text-lg text-cyan-400 mb-2">Student</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>View Dashboard & Academic Records</li>
                        <li>Use E-Wallet and E-Canteen</li>
                        <li>Interact with Social Features (Groups, Feed)</li>
                        <li>Use AI Assistant & Exploration Hub</li>
                    </ul>
                </div>
                 <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold text-lg text-cyan-400 mb-2">UNEB / NCHE Admins</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Manage national examination results database</li>
                        <li>Manage higher education institutions and programs</li>
                    </ul>
                </div>
            </div>
        </div>
    );

    const renderReadme = () => (
        <div ref={readmeRef} className="printable-section bg-gray-800 p-6 rounded-lg text-white">
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-bold">README</h3>
                <button onClick={() => handleDownload(readmeRef)} className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700">Download PDF</button>
            </div>
            <article className="prose prose-invert prose-sm md:prose-base max-w-none">
                <h1>360 Smart School App</h1>
                <p>A hands-free, AI-powered smart school application with a voice-first interface, built with React, TypeScript, and Tailwind CSS. This project demonstrates a modern, client-side application architecture leveraging browser storage as a mock backend.</p>
                
                <h2>Key Features</h2>
                <ul>
                    <li><strong>Multi-Role Authentication:</strong> Supports Superadmin, Headteacher, Teacher, Student, and other administrative roles. Includes a voice-controlled login flow.</li>
                    <li><strong>Modular Architecture:</strong> Features like Smart Admission, E-Wallet, Social Hub, and E-Canteen are managed as assignable modules.</li>
                    <li><strong>AI Integration (Gemini):</strong> Utilizes Google's Gemini API for voice transcription, image-to-text extraction (UNEB slips), generative chat, and search grounding.</li>
                    <li><strong>Interactive Dashboards:</strong> Tailored dashboards for each user role to manage their specific tasks and view relevant information.</li>
                    <li><strong>Data Persistence:</strong> Uses <code>localStorage</code> for core data (users, schools, settings) and <code>IndexedDB</code> for scalable data (chat history), simulating a complete backend within the browser.</li>
                    <li><strong>3D/AR Exploration:</strong> An interactive module using React Three Fiber to display 3D models for educational purposes.</li>
                </ul>

                <h2>Tech Stack</h2>
                <ul>
                    <li><strong>Frontend:</strong> React 19, TypeScript</li>
                    <li><strong>Styling:</strong> Tailwind CSS</li>
                    <li><strong>AI:</strong> Google Gemini API (`@google/genai`)</li>
                    <li><strong>3D Graphics:</strong> Three.js, React Three Fiber, React Three Drei</li>
                    <li><strong>AR:</strong> WebXR, React Three XR</li>
                    <li><strong>Client-Side Storage:</strong> <code>localStorage</code>, <code>IndexedDB</code></li>
                </ul>

                <h2>User Roles & Credentials</h2>
                <p>The system is seeded with the following default users. The default password for all is <code>admin</code>.</p>
                <ul>
                    <li><strong>Superadmin:</strong> ID: <code>admin</code></li>
                    <li><strong>Headteacher (Northwood):</strong> Email: <code>headteacher1@school.com</code></li>
                    <li><strong>Teacher (Northwood):</strong> ID: <code>teacher1</code></li>
                    <li><strong>Student (Northwood):</strong> ID: <code>S001</code>, <code>S002</code></li>
                </ul>
            </article>
        </div>
    );
    
    const renderReport = () => (
        <div ref={reportRef} className="printable-section bg-gray-800 p-6 rounded-lg text-white">
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-bold">System Report</h3>
                <button onClick={() => handleDownload(reportRef)} className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700">Download PDF</button>
            </div>
             <article className="prose prose-invert prose-sm md:prose-base max-w-none">
                <h1>360 Smart School System Report</h1>
                
                <h2>1. Executive Summary</h2>
                <p>The 360 Smart School project is a comprehensive, AI-enhanced school management platform designed to digitize and streamline academic and administrative processes. It serves multiple user roles through a modular, scalable architecture built entirely on modern frontend technologies. By leveraging the Google Gemini API and in-browser databases, it provides a rich, interactive user experience without a traditional backend, making it a powerful demonstration of client-side application capabilities.</p>

                <h2>2. System Objectives</h2>
                <ul>
                    <li>To provide a centralized digital platform for students, teachers, and administrators.</li>
                    <li>To automate and simplify processes like student admission, fee payment, and results management.</li>
                    <li>To enhance student engagement through interactive learning tools (AI Chat, 3D Exploration) and social features.</li>
                    <li>To empower administrators with tools for efficient school, user, and module management.</li>
                </ul>

                <h2>3. Functional Requirements</h2>
                <p>The system is broken down into key modules, each with specific functionalities:</p>
                <ul>
                    <li><strong>Authentication:</strong> Users can log in via text or voice. Role-based access control restricts functionality.</li>
                    <li><strong>Smart Admission:</strong> Students can apply by scanning a UNEB slip (image-to-text) or looking up an index number. Headteachers can review and manage these applications.</li>
                    <li><strong>E-Wallet:</strong> Users have a digital wallet for fee payments, canteen purchases, and other transactions. Admins can oversee school-wide financial activity.</li>
                    <li><strong>Social Hub:</strong> Provides messaging, groups, and announcement channels for school communication.</li>
                    <li><strong>E-Canteen:</strong> A complete POS system allowing students to order food and sellers to manage menus and orders.</li>
                    <li><strong>NCHE & Exploration:</strong> AI-powered guidance for higher education and interactive 3D models for learning.</li>
                </ul>

                <h2>4. AI Integration (Google Gemini API)</h2>
                <p>The Gemini API is integral to the application's "smart" features:</p>
                <ul>
                    <li><strong>`gemini-2.5-flash` is used for:</strong></li>
                    <ul>
                        <li>**Voice Transcription:** Powering the voice-controlled login and other future voice commands.</li>
                        <li>**Image Analysis:** Extracting structured JSON data from UNEB pass slip images.</li>
                        <li>**Barcode Decoding:** Identifying and decoding barcodes from ID card images for the POS system.</li>
                        <li>**Generative Chat:** Providing students with a conversational AI assistant.</li>
                        <li>**Text Translation:** Translating messages within the social hub.</li>
                        <li>**AI Grounding:** Using Google Search to provide real-time news summaries.</li>
                    </ul>
                </ul>

                <h2>5. Architecture & Design</h2>
                <p>The application follows a frontend-centric model:</p>
                <ul>
                    <li><strong>Component-Based UI:</strong> Built with React, ensuring a modular, reusable, and maintainable user interface.</li>
                    <li><strong>Service-Oriented Logic:</strong> Business logic is encapsulated in TypeScript services (e.g., `studentService`, `eWalletService`). This separates data handling from the UI, making the code cleaner and easier to test.</li>
                    <li><strong>Mock Backend:</strong> <code>localStorage</code> is used for structured, less frequently changing data (users, schools, settings). <code>IndexedDB</code> is employed for larger, more dynamic datasets like chat history, demonstrating its suitability for scalable client-side storage.</li>
                </ul>
                
                <h2>6. Conclusion</h2>
                <p>The 360 Smart School project successfully demonstrates the feasibility of building a complex, feature-rich application using a purely client-side stack augmented by powerful cloud-based AI services. It serves as a robust blueprint for modern web applications that prioritize user experience, interactivity, and rapid development.</p>
            </article>
        </div>
    );


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 p-1 bg-gray-900 rounded-lg mb-6 sticky top-20 z-10 no-print">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveDiagram(tab.id)}
                        className={`w-full py-2 text-sm font-semibold rounded-md ${activeDiagram === tab.id ? 'bg-cyan-600' : 'hover:bg-gray-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeDiagram === 'blueprint' && renderBlueprint()}
            {activeDiagram === 'erd' && renderErd()}
            {activeDiagram === 'usecase' && renderUsecase()}
            {activeDiagram === 'readme' && renderReadme()}
            {activeDiagram === 'report' && renderReport()}
        </div>
    );
};

export default ProjectPlanView;