

import React, { useEffect, useRef } from 'react';
import { User, School, CustomIdTemplate, TemplateField } from '../types';

declare var QRCode: any;

interface CustomSmartIdCardProps {
    user: User;
    school: School;
    template: CustomIdTemplate;
}

const RenderedField: React.FC<{ field: TemplateField; user: User; school: School }> = ({ field, user, school }) => {
    const qrCodeRef = useRef<HTMLDivElement>(null);

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${field.x}%`,
        top: `${field.y}%`,
        width: `${field.width}%`,
        height: `${field.height}%`,
        color: field.color,
        fontSize: `${field.fontSize}px`,
        fontWeight: field.fontWeight,
        textAlign: field.textAlign,
        display: 'flex',
        alignItems: 'center',
        justifyContent: field.textAlign === 'center' ? 'center' : (field.textAlign === 'right' ? 'flex-end' : 'flex-start'),
        wordBreak: 'break-word',
        overflow: 'hidden',
    };

    useEffect(() => {
        if (field.type === 'qrcode' && qrCodeRef.current && qrCodeRef.current.innerHTML === "") {
            const qrCodeData = JSON.stringify({ studentId: user.studentId, name: user.name, schoolId: school.id });
            new QRCode(qrCodeRef.current, {
                text: qrCodeData,
                width: 256, // High res for scaling
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }, [field.type, user, school]);

    switch (field.type) {
        case 'photo':
            return <img src={user.avatarUrl || `https://picsum.photos/seed/${user.studentId}/150`} alt="Student" style={{...style, objectFit: 'cover'}} />;
        case 'qrcode':
            return <div ref={qrCodeRef} style={{ ...style, display: 'block' }}><div style={{ width: '100%', height: '100%' }} /></div>;
        case 'static-text':
            return <div style={style}>{field.label}</div>;
        case 'text':
            let textContent: any = 'N/A';
            if (field.userProperty === 'class' && user.class) {
                textContent = user.stream ? `${user.class} / ${user.stream}` : user.class;
            } else if (field.userProperty) {
                textContent = user[field.userProperty] || 'N/A';
            }
            return <div style={style}>{textContent}</div>;
        default:
            return null;
    }
};


const CustomSmartIdCard: React.FC<CustomSmartIdCardProps> = ({ user, school, template }) => {
    return (
        <div className="w-[512px] h-[320px] rounded-2xl shadow-2xl bg-gray-300 font-sans relative select-none overflow-hidden">
            {/* Front */}
            <div className="w-full h-full">
                <img src={template.frontBackground} className="w-full h-full object-cover" alt="ID Card Front Background" />
                {template.fields.map(field => (
                    <RenderedField key={field.id} field={field} user={user} school={school} />
                ))}
            </div>
        </div>
    );
};

export const CustomSmartIdCardDownloadable: React.FC<CustomSmartIdCardProps> = ({ user, school, template }) => {
     return (
        <div className="flex flex-col space-y-4">
            {/* Front */}
            <div id="id-card-front-container" className="w-[512px] h-[320px] rounded-2xl bg-gray-300 font-sans relative overflow-hidden">
                <img src={template.frontBackground} className="w-full h-full object-cover" alt="ID Card Front Background" crossOrigin="anonymous" />
                {template.fields.map(field => (
                    <RenderedField key={field.id} field={field} user={user} school={school} />
                ))}
            </div>
             {/* Back */}
            <div id="id-card-back-container" className="w-[512px] h-[320px] rounded-2xl bg-gray-300 font-sans relative overflow-hidden">
                <img src={template.backBackground} className="w-full h-full object-cover" alt="ID Card Back Background" crossOrigin="anonymous"/>
                {template.fields.map(field => (
                    <RenderedField key={field.id} field={field} user={user} school={school} />
                ))}
            </div>
        </div>
    );
};

export default CustomSmartIdCard;