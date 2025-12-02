import React, { useState, useRef, useEffect } from 'react';
import { School, CustomIdTemplate, TemplateField, User } from '../types';
import * as templateService from '../services/customIdTemplateService';
import CustomSmartIdCard from './CustomSmartIdCard';

interface IdCardDesignerProps {
    school: School;
    onTemplateSave: () => void;
}

const availableFields: Omit<TemplateField, 'id' | 'x' | 'y'>[] = [
    { type: 'photo', width: 25, height: 40, color: '#000000', fontSize: 14, fontWeight: 'normal', textAlign: 'left' },
    { type: 'text', userProperty: 'name', label: 'Full Name', width: 60, height: 8, color: '#000000', fontSize: 24, fontWeight: 'bold', textAlign: 'left' },
    { type: 'text', userProperty: 'studentId', label: 'Student ID', width: 40, height: 5, color: '#333333', fontSize: 16, fontWeight: 'normal', textAlign: 'left' },
    { type: 'text', userProperty: 'class', label: 'Class/Stream', width: 40, height: 5, color: '#333333', fontSize: 16, fontWeight: 'normal', textAlign: 'left' },
    { type: 'static-text', label: 'School Name', width: 60, height: 8, color: '#000000', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    { type: 'qrcode', width: 25, height: 35, color: '#000000', fontSize: 14, fontWeight: 'normal', textAlign: 'left' },
];

const IdCardDesigner: React.FC<IdCardDesignerProps> = ({ school, onTemplateSave }) => {
    const [template, setTemplate] = useState<CustomIdTemplate>(() => templateService.getCustomIdTemplate(school.id));
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [activeCard, setActiveCard] = useState<'front' | 'back'>('front');
    const cardRef = useRef<HTMLDivElement>(null);
    const dragInfo = useRef<{ fieldId: string; offsetX: number; offsetY: number } | null>(null);

    const selectedField = template.fields.find(f => f.id === selectedFieldId);

    const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setTemplate(prev => ({ ...prev, [side === 'front' ? 'frontBackground' : 'backBackground']: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDragStart = (e: React.DragEvent, field: Omit<TemplateField, 'id' | 'x' | 'y'>) => {
        e.dataTransfer.setData('application/json', JSON.stringify(field));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const fieldData = JSON.parse(e.dataTransfer.getData('application/json'));
        if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            const newField: TemplateField = {
                ...fieldData,
                id: `${fieldData.type}_${Date.now()}`,
                x: Math.max(0, x - (fieldData.width / 2)), // Center on drop
                y: Math.max(0, y - (fieldData.height / 2)),
            };
            setTemplate(prev => ({ ...prev, fields: [...prev.fields, newField] }));
        }
    };
    
    const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedFieldId(fieldId);
        const fieldElement = e.currentTarget as HTMLDivElement;
        const rect = fieldElement.getBoundingClientRect();
        dragInfo.current = {
            fieldId,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragInfo.current || !cardRef.current) return;
        
        const cardRect = cardRef.current.getBoundingClientRect();
        const newX = ((e.clientX - cardRect.left - dragInfo.current.offsetX) / cardRect.width) * 100;
        const newY = ((e.clientY - cardRect.top - dragInfo.current.offsetY) / cardRect.height) * 100;

        setTemplate(prev => ({
            ...prev,
            fields: prev.fields.map(f => f.id === dragInfo.current!.fieldId ? { ...f, x: newX, y: newY } : f)
        }));
    };

    const handleMouseUp = () => {
        dragInfo.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    const updateSelectedField = (props: Partial<TemplateField>) => {
        if (!selectedFieldId) return;
        setTemplate(prev => ({
            ...prev,
            fields: prev.fields.map(f => f.id === selectedFieldId ? { ...f, ...props } : f)
        }));
    };
    
    const handleSave = () => {
        templateService.saveCustomIdTemplate(template);
        onTemplateSave();
    };

    const sampleUser: User = { name: 'Morgan Maxwell', studentId: 'S-12345', class: 'Grade 10', stream: 'A', role: 'student' };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center space-x-2 p-1 bg-gray-900 rounded-lg">
                    <button onClick={() => setActiveCard('front')} className={`w-full py-2 rounded-md font-semibold ${activeCard === 'front' ? 'bg-cyan-600' : ''}`}>Front</button>
                    <button onClick={() => setActiveCard('back')} className={`w-full py-2 rounded-md font-semibold ${activeCard === 'back' ? 'bg-cyan-600' : ''}`}>Back</button>
                </div>
                <div ref={cardRef} onDrop={handleDrop} onDragOver={e => e.preventDefault()} className="relative w-full aspect-[1.6] bg-gray-700 rounded-lg overflow-hidden">
                    <img src={activeCard === 'front' ? template.frontBackground : template.backBackground} className="w-full h-full object-cover" alt="Background" />
                    {template.fields.map(field => (
                        <div
                            key={field.id}
                            onMouseDown={e => handleFieldMouseDown(e, field.id)}
                            className={`absolute cursor-move p-1 border-2 ${selectedFieldId === field.id ? 'border-cyan-400' : 'border-transparent hover:border-dashed hover:border-gray-400'}`}
                            style={{ left: `${field.x}%`, top: `${field.y}%`, width: `${field.width}%`, height: `${field.height}%` }}
                        >
                            <div style={{ pointerEvents: 'none', width: '100%', height: '100%', fontSize: `${field.fontSize}px`, color: field.color, fontWeight: field.fontWeight, textAlign: field.textAlign }}>
                                {field.type === 'photo' && <div className="w-full h-full bg-gray-400 flex items-center justify-center text-xs">Photo</div>}
                                {field.type === 'qrcode' && <div className="w-full h-full bg-gray-400 flex items-center justify-center text-xs">QR</div>}
                                {field.type === 'text' && <span>{field.label}</span>}
                                {field.type === 'static-text' && <span>{field.label}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold mb-2">Background</h4>
                    <label className="block text-sm text-cyan-400 hover:underline cursor-pointer">
                        Upload {activeCard} background
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleBackgroundUpload(e, activeCard)} />
                    </label>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-bold mb-2">Available Fields</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {availableFields.map((field, i) => (
                            <div key={i} draggable onDragStart={e => handleDragStart(e, field)} className="p-2 bg-gray-600 rounded-md text-sm text-center cursor-grab">
                                {field.label || field.type}
                            </div>
                        ))}
                    </div>
                </div>

                {selectedField && (
                    <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                        <h4 className="font-bold">Properties: {selectedField.label || selectedField.type}</h4>
                        {selectedField.type.includes('text') && (
                             <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-xs">Font Size</label><input type="number" value={selectedField.fontSize} onChange={e => updateSelectedField({ fontSize: parseInt(e.target.value) })} className="w-full bg-gray-600 p-1 rounded" /></div>
                                    <div><label className="text-xs">Color</label><input type="color" value={selectedField.color} onChange={e => updateSelectedField({ color: e.target.value })} className="w-full h-8 p-0 bg-transparent border-none" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs">Weight</label>
                                        <select value={selectedField.fontWeight} onChange={e => updateSelectedField({ fontWeight: e.target.value as any })} className="w-full bg-gray-600 p-1 rounded">
                                            <option value="normal">Normal</option><option value="bold">Bold</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs">Align</label>
                                        <select value={selectedField.textAlign} onChange={e => updateSelectedField({ textAlign: e.target.value as any })} className="w-full bg-gray-600 p-1 rounded">
                                            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                                        </select>
                                    </div>
                                </div>
                             </>
                        )}
                        <button onClick={() => setTemplate(p => ({ ...p, fields: p.fields.filter(f => f.id !== selectedFieldId)}))} className="w-full text-red-400 text-sm p-1 hover:bg-red-900/50 rounded">Delete Field</button>
                    </div>
                )}
                 <button onClick={handleSave} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Save Template</button>
            </div>
        </div>
    );
};

export default IdCardDesigner;