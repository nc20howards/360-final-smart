import { CustomIdTemplate, TemplateField } from '../types';

const TEMPLATES_KEY = '360_smart_school_custom_id_templates';

const getAllTemplates = (): Record<string, CustomIdTemplate> => {
    const data = localStorage.getItem(TEMPLATES_KEY);
    return data ? JSON.parse(data) : {};
};

const saveAllTemplates = (templates: Record<string, CustomIdTemplate>) => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
};

export const getDefaultTemplate = (schoolId: string): CustomIdTemplate => {
    const defaultFields: TemplateField[] = [
        { id: 'photo_1', type: 'photo', x: 5, y: 15, width: 25, height: 40, fontSize: 16, fontWeight: 'normal', textAlign: 'left', color: '#000000' },
        { id: 'name_1', type: 'text', userProperty: 'name', x: 35, y: 20, width: 60, height: 8, fontSize: 24, fontWeight: 'bold', textAlign: 'left', color: '#000000' },
        { id: 'id_1', type: 'text', userProperty: 'studentId', x: 35, y: 35, width: 60, height: 5, fontSize: 16, fontWeight: 'normal', textAlign: 'left', color: '#333333' },
        { id: 'class_1', type: 'text', userProperty: 'class', x: 35, y: 45, width: 60, height: 5, fontSize: 16, fontWeight: 'normal', textAlign: 'left', color: '#333333' },
        { id: 'qrcode_1', type: 'qrcode', x: 70, y: 60, width: 25, height: 35, fontSize: 16, fontWeight: 'normal', textAlign: 'left', color: '#000000' },
    ];

    return {
        schoolId,
        frontBackground: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjMyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmMDBhYmUiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNlOGU4ZTgiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIiAvPjwvc3ZnPg==',
        backBackground: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjMyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNlOGU4ZTgiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNmMDBhYmUiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2IpIiAvPjwvc3ZnPg==',
        fields: defaultFields,
    };
};

export const getCustomIdTemplate = (schoolId: string): CustomIdTemplate => {
    const allTemplates = getAllTemplates();
    return allTemplates[schoolId] || getDefaultTemplate(schoolId);
};

export const saveCustomIdTemplate = (template: CustomIdTemplate): void => {
    const allTemplates = getAllTemplates();
    allTemplates[template.schoolId] = template;
    saveAllTemplates(allTemplates);
};