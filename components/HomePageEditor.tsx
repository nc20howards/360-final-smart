import React, { useState, useEffect } from 'react';
import { School, HomePageContent } from '../types';
import { getHomePageContent, saveHomePageContent } from '../services/homePageService';
import { publishHomePage, unpublishHomePage } from '../services/schoolService';
import HomePagePreview from './HomePagePreview';

interface HomePageEditorProps {
    school: School;
}

interface AccordionSectionProps {
    title: string;
    children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-gray-700 rounded-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 bg-gray-700 hover:bg-gray-600 focus:outline-none"
            >
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <svg className={`w-6 h-6 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
};


const HomePageEditor: React.FC<HomePageEditorProps> = ({ school }) => {
    const [content, setContent] = useState<HomePageContent | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [confirmationModal, setConfirmationModal] = useState<{
        message: React.ReactNode;
        onConfirm: () => void;
    } | null>(null);
    const [isPublished, setIsPublished] = useState(school.isHomePagePublished || false);


    useEffect(() => {
        const contentData = getHomePageContent(school.id);
        setContent(contentData);
        setIsPublished(school.isHomePagePublished || false);
    }, [school.id, school.isHomePagePublished]);

    const handleSave = () => {
        if (content) {
            saveHomePageContent(content);
            setSuccessMessage('Home page content saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };
    
    const handlePreview = () => {
        setIsPreviewing(true);
    };

    const handlePublish = () => {
        if (content) {
            // Save any pending changes first to ensure the published version is up-to-date
            saveHomePageContent(content);
            publishHomePage(school.id);
            setIsPublished(true);
            setSuccessMessage('Your home page has been published successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const handleUnpublish = () => {
        unpublishHomePage(school.id);
        setIsPublished(false);
        setSuccessMessage('Your home page has been unpublished.');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleHeroChange = (field: keyof HomePageContent['hero'], value: any) => {
        if (!content) return;
        setContent(prev => ({
            ...prev!,
            hero: {
                ...prev!.hero,
                [field]: value,
            }
        }));
    };

    const handleInputChange = (section: keyof Omit<HomePageContent, 'hero'>, field: string, value: string) => {
        if (!content) return;
        const newContent = { ...content };
        (newContent[section] as any)[field] = value;
        setContent(newContent);
    };
    
    const handleNestedInputChange = (section: keyof HomePageContent, subSection: string, field: string, value: string) => {
         if (!content) return;
         const newContent = { ...content };
        (newContent[section] as any)[subSection][field] = value;
        setContent(newContent);
    };

    const handleListChange = (section: keyof HomePageContent, index: number, field: string, value: string) => {
        if (!content) return;
        const newContent = { ...content };
        ((newContent[section] as any).items[index] as any)[field] = value;
        setContent(newContent);
    };

    const handleAddItem = (section: keyof HomePageContent, newItem: any) => {
         if (!content) return;
         const newContent = { ...content };
         (newContent[section] as any).items.push(newItem);
         setContent(newContent);
    };

    const handleRemoveItem = (section: keyof HomePageContent, index: number, itemName?: string) => {
        if (!content) return;
        const itemIdentifier = itemName ? <strong>"{itemName}"</strong> : 'this item';
        setConfirmationModal({
            message: <p>Are you sure you want to remove {itemIdentifier}? This action cannot be undone.</p>,
            onConfirm: () => {
                const newContent = { ...content };
                (newContent[section] as any).items.splice(index, 1);
                setContent(newContent);
                setConfirmationModal(null);
            },
        });
    };
    
    const handleCoreValueChange = (index: number, value: string) => {
        if (!content) return;
        const newValues = [...content.welcome.coreValues];
        newValues[index] = value;
        setContent({ ...content, welcome: { ...content.welcome, coreValues: newValues }});
    };
    
    const addCoreValue = () => {
         if (!content) return;
         const newValues = [...content.welcome.coreValues, 'New Value'];
         setContent({ ...content, welcome: { ...content.welcome, coreValues: newValues }});
    };

    const removeCoreValue = (index: number) => {
        if (!content) return;
        const value = content.welcome.coreValues[index] || 'this value';
        setConfirmationModal({
            message: <p>Are you sure you want to remove the core value <strong>"{value}"</strong>? This action cannot be undone.</p>,
            onConfirm: () => {
                const newValues = content.welcome.coreValues.filter((_, i) => i !== index);
                setContent({ ...content, welcome: { ...content.welcome, coreValues: newValues } });
                setConfirmationModal(null);
            },
        });
    };
    
    const handleFileUpload = (
        event: React.ChangeEvent<HTMLInputElement>,
        callback: (value: string) => void
    ) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    callback(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSliderImageChange = (id: string, newUrl: string) => {
        if (!content) return;
        const newSliderImages = content.hero.sliderImages.map(img =>
            img.id === id ? { ...img, url: newUrl } : img
        );
        handleHeroChange('sliderImages', newSliderImages);
    };

    const handleAddSliderImage = () => {
        if (!content) return;
        const newImage = { id: `slide_${Date.now()}`, url: '' };
        const newSliderImages = [...content.hero.sliderImages, newImage];
        handleHeroChange('sliderImages', newSliderImages);
    };

    const handleRemoveSliderImage = (id: string) => {
        if (!content) return;
        const newSliderImages = content.hero.sliderImages.filter(img => img.id !== id);
        handleHeroChange('sliderImages', newSliderImages);
    };


    if (!content) {
        return <div>Loading editor...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Home Page</h2>
                 <div className="flex flex-col sm:flex-row items-center gap-4">
                    {isPublished && (
                        <span className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-300 text-sm font-semibold rounded-full">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                            Published
                        </span>
                    )}
                    {successMessage && <span className="text-green-400">{successMessage}</span>}
                    <button onClick={handlePreview} className="w-full sm:w-auto px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors">
                        Preview
                    </button>
                    <button onClick={handleSave} className="w-full sm:w-auto px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold transition-colors">
                        Save Changes
                    </button>
                    {!isPublished ? (
                        <button onClick={handlePublish} className="w-full sm:w-auto px-6 py-2 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition-colors">
                            Publish
                        </button>
                    ) : (
                        <button onClick={handleUnpublish} className="w-full sm:w-auto px-6 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md font-semibold transition-colors">
                            Unpublish
                        </button>
                    )}
                </div>
            </div>

            {/* Editor Accordions... */}
            <AccordionSection title="Hero Section">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">School Logo URL</label>
                    <div className="flex items-center space-x-2">
                         <input 
                            value={content.hero.logoUrl} 
                            onChange={e => handleHeroChange('logoUrl', e.target.value)} 
                            className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" 
                            placeholder="Paste image URL or upload"
                        />
                        <label 
                            htmlFor="logo-upload"
                            className="cursor-pointer px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors text-sm whitespace-nowrap"
                        >
                            Upload
                        </label>
                        <input 
                            id="logo-upload"
                            type="file"
                            accept="image/png, image/jpeg, image/gif, image/svg+xml"
                            className="hidden"
                            onChange={e => handleFileUpload(e, (value) => handleHeroChange('logoUrl', value))}
                        />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Main Title</label>
                    <input value={content.hero.title} onChange={e => handleHeroChange('title', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">School Motto</label>
                    <input value={content.hero.subtitle} onChange={e => handleHeroChange('subtitle', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Button Text</label>
                    <input value={content.hero.buttonText} onChange={e => handleHeroChange('buttonText', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                <div className="border-t border-gray-600 pt-4 mt-4">
                    <h4 className="text-lg font-bold text-white mb-2">Header Color Scheme</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Header Background</label>
                            <input 
                                type="color"
                                value={content.hero.headerBackgroundColor || '#FFFFFF'}
                                onChange={e => handleHeroChange('headerBackgroundColor', e.target.value)}
                                className="w-full h-10 p-1 bg-gray-900 rounded-md cursor-pointer border-2 border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Header Text &amp; Icons</label>
                            <input 
                                type="color"
                                value={content.hero.headerTextColor || '#0e7490'}
                                onChange={e => handleHeroChange('headerTextColor', e.target.value)}
                                className="w-full h-10 p-1 bg-gray-900 rounded-md cursor-pointer border-2 border-gray-600"
                            />
                        </div>
                    </div>
                </div>
                 <div className="border-t border-gray-600 pt-4 mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Background Type</label>
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="backgroundType" value="single_image" checked={content.hero.backgroundType === 'single_image'} onChange={() => handleHeroChange('backgroundType', 'single_image')} className="form-radio h-4 w-4 text-cyan-600 bg-gray-800 border-gray-600 focus:ring-cyan-500"/><span>Single Image</span></label>
                        <label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="backgroundType" value="slider" checked={content.hero.backgroundType === 'slider'} onChange={() => handleHeroChange('backgroundType', 'slider')} className="form-radio h-4 w-4 text-cyan-600 bg-gray-800 border-gray-600 focus:ring-cyan-500"/><span>Image Slider</span></label>
                    </div>
                </div>

                {content.hero.backgroundType === 'single_image' ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mt-4 mb-1">Background Image URL</label>
                        <div className="flex items-center space-x-2">
                            <input value={content.hero.imageUrl} onChange={e => handleHeroChange('imageUrl', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md" placeholder="Paste image URL or upload" />
                            <label htmlFor="bg-image-upload" className="cursor-pointer px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold text-sm whitespace-nowrap">Upload</label>
                            <input id="bg-image-upload" type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, (value) => handleHeroChange('imageUrl', value))} />
                        </div>
                    </div>
                ) : (
                    <div className="border-t border-gray-600 pt-4 mt-4">
                        <h4 className="text-lg font-bold text-white mb-2">Slider Images</h4>
                        <div className="space-y-3">
                            {content.hero.sliderImages.map((image) => (
                                <div key={image.id} className="flex items-center space-x-2">
                                    <input value={image.url} onChange={(e) => handleSliderImageChange(image.id, e.target.value)} placeholder="Image URL" className="w-full px-4 py-2 text-white bg-gray-900 rounded-md"/>
                                    <label htmlFor={`slider-upload-${image.id}`} className="cursor-pointer px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold text-sm whitespace-nowrap">
                                        Upload
                                    </label>
                                    <input
                                        id={`slider-upload-${image.id}`}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => handleFileUpload(e, (value) => handleSliderImageChange(image.id, value))}
                                    />
                                    <button onClick={() => handleRemoveSliderImage(image.id)} className="p-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-bold">&times;</button>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddSliderImage} className="mt-3 px-4 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-sm">+ Add Image</button>
                    </div>
                )}

                <div className="border-t border-gray-600 pt-4 mt-4">
                    <h4 className="text-lg font-bold text-white mb-2">Marquee / Scrolling Text</h4>
                    <div className="flex items-center space-x-3 mb-2">
                        <input
                            id="marquee-enabled"
                            type="checkbox"
                            checked={content.hero.marquee.enabled}
                            onChange={e => handleHeroChange('marquee', { ...content.hero.marquee, enabled: e.target.checked })}
                            className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500"
                        />
                        <label htmlFor="marquee-enabled" className="text-sm font-medium text-gray-300">Enable Marquee</label>
                    </div>
                    {content.hero.marquee.enabled && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Marquee Text</label>
                            <input
                                value={content.hero.marquee.text}
                                onChange={e => handleHeroChange('marquee', { ...content.hero.marquee, text: e.target.value })}
                                className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400"
                            />
                        </div>
                    )}
                </div>
            </AccordionSection>

            <AccordionSection title="Welcome Section">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Section Title</label>
                    <input value={content.welcome.title} onChange={e => handleInputChange('welcome', 'title', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Main Paragraph</label>
                    <textarea value={content.welcome.mainText} onChange={e => handleInputChange('welcome', 'mainText', e.target.value)} rows={4} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                <div className="border-t border-gray-600 pt-4">
                     <h4 className="text-lg font-bold text-white mb-2">Director's Message</h4>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Director Image URL</label>
                        <input value={content.welcome.director.imageUrl} onChange={e => handleNestedInputChange('welcome', 'director', 'imageUrl', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Director's Name</label>
                        <input value={content.welcome.director.name} onChange={e => handleNestedInputChange('welcome', 'director', 'name', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Director's Title</label>
                        <input value={content.welcome.director.title} onChange={e => handleNestedInputChange('welcome', 'director', 'title', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Quote</label>
                        <textarea value={content.welcome.director.quote} onChange={e => handleNestedInputChange('welcome', 'director', 'quote', e.target.value)} rows={3} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                    </div>
                </div>
                 <div className="border-t border-gray-600 pt-4">
                    <h4 className="text-lg font-bold text-white mb-2">Core Values</h4>
                    <div className="space-y-2">
                        {content.welcome.coreValues.map((value, index) => (
                             <div key={index} className="flex items-center space-x-2">
                                <input value={value} onChange={e => handleCoreValueChange(index, e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                                <button onClick={() => removeCoreValue(index)} className="p-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-bold">&times;</button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addCoreValue} className="mt-2 px-4 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-sm">Add Value</button>
                </div>
            </AccordionSection>

            <AccordionSection title="Why Choose Us Section">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Section Title</label>
                    <input value={content.whyChooseUs.title} onChange={e => handleInputChange('whyChooseUs', 'title', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                <div className="space-y-4">
                     {content.whyChooseUs.items.map((item, index) => (
                        <div key={item.id} className="p-3 border border-gray-600 rounded-md space-y-2">
                            <div className="flex justify-between">
                                <h4 className="font-semibold text-white">Item {index + 1}</h4>
                                <button onClick={() => handleRemoveItem('whyChooseUs', index, item.title)} className="text-red-500 hover:text-red-400 text-sm font-semibold">Remove</button>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                                <input value={item.title} onChange={e => handleListChange('whyChooseUs', index, 'title', e.target.value)} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                                <textarea value={item.description} onChange={e => handleListChange('whyChooseUs', index, 'description', e.target.value)} rows={2} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                        </div>
                    ))}
                </div>
                 <button onClick={() => handleAddItem('whyChooseUs', { id: `why_${Date.now()}`, title: 'New Feature', description: 'Description' })} className="mt-2 px-4 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-sm">Add Item</button>
            </AccordionSection>
            
             <AccordionSection title="Campuses Section">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Section Title</label>
                    <input value={content.campuses.title} onChange={e => handleInputChange('campuses', 'title', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                <div className="space-y-4">
                     {content.campuses.items.map((item, index) => (
                        <div key={item.id} className="p-3 border border-gray-600 rounded-md space-y-2">
                            <div className="flex justify-between">
                                <h4 className="font-semibold text-white">Campus {index + 1}</h4>
                                <button onClick={() => handleRemoveItem('campuses', index, item.name)} className="text-red-500 hover:text-red-400 text-sm font-semibold">Remove</button>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Image URL</label>
                                <input value={item.imageUrl} onChange={e => handleListChange('campuses', index, 'imageUrl', e.target.value)} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Campus Name</label>
                                <input value={item.name} onChange={e => handleListChange('campuses', index, 'name', e.target.value)} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                                <textarea value={item.description} onChange={e => handleListChange('campuses', index, 'description', e.target.value)} rows={2} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                        </div>
                    ))}
                </div>
                 <button onClick={() => handleAddItem('campuses', { id: `campus_${Date.now()}`, imageUrl: 'https://via.placeholder.com/400x300.png?text=New+Campus', name: 'New Campus', description: 'Description' })} className="mt-2 px-4 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-sm">Add Campus</button>
            </AccordionSection>

             <AccordionSection title="News & Events Section">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Section Title</label>
                    <input value={content.news.title} onChange={e => handleInputChange('news', 'title', e.target.value)} className="w-full px-4 py-2 text-white bg-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400" />
                </div>
                <div className="space-y-4">
                     {content.news.items.map((item, index) => (
                        <div key={item.id} className="p-3 border border-gray-600 rounded-md space-y-2">
                            <div className="flex justify-between">
                                <h4 className="font-semibold text-white">News Item {index + 1}</h4>
                                <button onClick={() => handleRemoveItem('news', index, item.title)} className="text-red-500 hover:text-red-400 text-sm font-semibold">Remove</button>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Image URL</label>
                                <input value={item.imageUrl} onChange={e => handleListChange('news', index, 'imageUrl', e.target.value)} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                                <input value={item.title} onChange={e => handleListChange('news', index, 'title', e.target.value)} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Date (YYYY-MM-DD)</label>
                                <input type="date" value={item.date} onChange={e => handleListChange('news', index, 'date', e.target.value)} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Excerpt</label>
                                <textarea value={item.excerpt} onChange={e => handleListChange('news', index, 'excerpt', e.target.value)} rows={2} className="w-full px-3 py-1 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-gray-400" />
                            </div>
                        </div>
                    ))}
                </div>
                 <button onClick={() => handleAddItem('news', { id: `news_${Date.now()}`, imageUrl: 'https://via.placeholder.com/400x300.png?text=New+Event', title: 'New Event', date: new Date().toISOString().split('T')[0], excerpt: 'Description of the new event.' })} className="mt-2 px-4 py-1 bg-gray-600 hover:bg-gray-500 rounded-md text-sm">Add News Item</button>
            </AccordionSection>

            {/* --- Live Preview Modal --- */}
            {isPreviewing && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto">
                    <div className="relative w-full">
                        <div className="fixed top-0 right-0 p-4 z-[60] flex items-center space-x-2 bg-gray-800 rounded-bl-lg shadow-lg">
                            <span className="text-white font-semibold">Live Preview Mode</span>
                            <button 
                                onClick={() => setIsPreviewing(false)} 
                                className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-md font-bold transition-colors"
                            >
                                Close Preview
                            </button>
                        </div>
                        <HomePagePreview content={content} />
                    </div>
                </div>
            )}

            {/* --- Confirmation Modal --- */}
            {confirmationModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-6 text-white">Confirm Deletion</h2>
                        <div className="text-gray-300 mb-6">{confirmationModal.message}</div>
                        <div className="flex justify-end space-x-4">
                            <button
                                onClick={() => setConfirmationModal(null)}
                                className="px-5 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmationModal.onConfirm}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-md font-semibold transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePageEditor;