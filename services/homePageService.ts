
import { HomePageContent } from '../types';
import { getAllSchools } from './schoolService';

const HOME_PAGE_CONTENT_KEY = '360_smart_school_home_page_content';

// Helper to get all home page content from localStorage
const getAllContent = (): HomePageContent[] => {
    const content = localStorage.getItem(HOME_PAGE_CONTENT_KEY);
    return content ? JSON.parse(content) : [];
};

// Helper to save all home page content to localStorage
const saveAllContent = (allContent: HomePageContent[]) => {
    localStorage.setItem(HOME_PAGE_CONTENT_KEY, JSON.stringify(allContent));
};

/**
 * Creates a default, empty structure for a school's home page.
 * @param schoolId The ID of the school.
 * @returns A default HomePageContent object.
 */
export const getDefaultHomePageContent = (schoolId: string): HomePageContent => {
    const school = getAllSchools().find(s => s.id === schoolId);
    const schoolName = school ? school.name : '360 Smart School';

    return {
        schoolId,
        hero: {
            logoUrl: 'https://picsum.photos/seed/school-logo/100/100',
            backgroundType: 'single_image',
            imageUrl: 'https://picsum.photos/seed/school-hero/1920/1080',
            sliderImages: [],
            title: `Welcome to ${schoolName}`,
            subtitle: "Excellence and Integrity",
            buttonText: 'Online Admission',
            marquee: {
                enabled: false,
                text: 'This is a sample scrolling text. Edit me in the home page editor!',
            },
            headerBackgroundColor: '#FF6347',
            headerTextColor: '#FFFFFF',
        },
        welcome: {
            title: `Welcome to ${schoolName}`,
            mainText: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
            director: {
                imageUrl: 'https://picsum.photos/seed/director/300/300',
                name: 'Mr. Howard',
                title: 'Director',
                quote: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.',
            },
            coreValues: ['Excellence', 'Integrity', 'Innovation', 'Community', 'Respect', 'Team Work'],
        },
        whyChooseUs: {
            title: `Why Choose ${schoolName}?`,
            items: [
                { id: `why_${Date.now()}`, title: 'Academic Excellence', description: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.' },
                { id: `why_${Date.now()+1}`, title: 'Supportive Community', description: 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione.' },
                { id: `why_${Date.now()+2}`, title: 'Great Learning Environment', description: 'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam.' },
            ],
        },
        campuses: {
            title: 'Our Smart Campuses',
            items: [
                 { id: `campus_${Date.now()}`, imageUrl: 'https://picsum.photos/seed/campus-main/400/300', name: 'Main Smart Campus', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
                 { id: `campus_${Date.now()+1}`, imageUrl: 'https://picsum.photos/seed/campus-mbalala/400/300', name: 'Mbalala Smart Campus', description: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.' },
                 { id: `campus_${Date.now()+2}`, imageUrl: 'https://picsum.photos/seed/campus-green/400/300', name: 'Green Smart Campus', description: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.' },
            ],
        },
        news: {
            title: 'News & Events',
            items: [
                 { id: `news_${Date.now()}`, imageUrl: 'https://picsum.photos/seed/news-uace/400/300', title: 'Celebrating Student Achievements This Year', date: '2024-03-08', excerpt: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' },
            ],
        },
    };
};

/**
 * Retrieves the home page content for a specific school.
 * If no content exists, it creates and returns a default structure.
 * @param schoolId The ID of the school.
 * @returns The HomePageContent for the school.
 */
export const getHomePageContent = (schoolId: string): HomePageContent => {
    const allContent = getAllContent();
    const schoolContent = allContent.find(c => c.schoolId === schoolId);
    if (schoolContent) {
        // Backward compatibility: Add new slider fields if they don't exist
        if (!schoolContent.hero.backgroundType) {
            schoolContent.hero.backgroundType = 'single_image';
            schoolContent.hero.sliderImages = [];
        }
        // Backward compatibility: Add new marquee field if it doesn't exist
        if (!schoolContent.hero.marquee) {
            schoolContent.hero.marquee = {
                enabled: false,
                text: 'This is a sample scrolling text. Edit me in the home page editor!',
            };
        }
        // Backward compatibility: Add header color fields if they don't exist
        if (!schoolContent.hero.headerBackgroundColor) {
            schoolContent.hero.headerBackgroundColor = '#FF6347';
        }
        if (!schoolContent.hero.headerTextColor) {
            schoolContent.hero.headerTextColor = '#FFFFFF';
        }
        return schoolContent;
    }
    return getDefaultHomePageContent(schoolId);
};

/**
 * Saves the home page content for a specific school.
 * @param content The HomePageContent object to save.
 */
export const saveHomePageContent = (content: HomePageContent): void => {
    const allContent = getAllContent();
    const schoolIndex = allContent.findIndex(c => c.schoolId === content.schoolId);
    if (schoolIndex > -1) {
        allContent[schoolIndex] = content;
    } else {
        allContent.push(content);
    }
    saveAllContent(allContent);
};
