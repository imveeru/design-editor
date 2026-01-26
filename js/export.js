import store, { LAYER_TYPES } from './state.js';
import { toRadians } from './utils.js';
import { renderStateToContext } from './canvas.js';

/* --- Mappings based on User Schema --- */

const GROUP_MAP = {
    'SM': 0, 'HC': 1, 'MM': 2, 'SMA': 3, 'EO': 4, 'BG': 5
};

const FORMAT_MAP = {
    'Instagram Story': 0, 'Instagram': 1, 'Facebook': 2, 'Facebook cover': 3, 'Twitter': 4,
    'Facebook AD': 5, 'Poster': 6, 'Instagram AD': 7, 'Tumblr': 8, 'Image': 9,
    'Pinterest': 10, 'Flayer': 11, 'FB event cover': 12, 'Postcard': 13, 'Invitation': 14,
    'Youtube': 15, 'Email header': 16, 'Medium Rectangle': 17, 'Graphic': 18, 'Large Rectangle': 19,
    'Poster US': 20, 'Card': 21, 'Logo': 22, 'Title': 23, 'Skyscraper': 24, 'Leaderboard': 25,
    'Presentation': 26, 'Gift Certificate': 27, 'VK Universal Post': 28, 'Youtube Thumbnail': 29,
    'Business card': 30, 'Book Cover': 31, 'Presentation Wide': 32, 'VK Community Cover': 33,
    'Certificate': 34, 'Zoom Background': 35, 'VK Post with Button': 36, 'T-Shirt': 37,
    'Instagram Highlight Cover': 38, 'Coupon': 39, 'Letterhead': 40, 'IGTV Cover': 41,
    'Album Cover': 42, 'LinkedIn Cover': 43, 'Storyboard': 44, 'Schedule Planner': 45,
    'Invoice': 46, 'Resume': 47, 'Recipe Card': 48, 'Menu': 49, 'Mood Board': 50,
    'Mind Map': 51, 'Label': 52, 'Newsletter': 53, 'Brochure': 54, 'Ticket': 55,
    'Proposal': 56, 'Snapchat Geofilter': 57, 'Snapchat Moment Filter': 58,
    'Twitch Offline Banner': 59, 'Twitch Profile Banner': 60, 'Infographic': 61,
    'Photo Book': 62, 'Mobile Presentation': 63, 'Web Banner': 64, 'Gallery Image': 65,
    'Calendar': 66
};

const CATEGORY_MAP = {
    'holidaysCelebration': 0, 'foodDrinks': 1, 'fashionStyle': 2, 'businessFinance': 3,
    'homeStuff': 4, 'handcraftArt': 5, 'beauty': 6, 'leisureEntertainment': 7,
    'natureWildlife': 8, 'educationScience': 9, 'technology': 10, 'medical': 11,
    'socialActivityCharity': 12, 'sportExtreme': 13, 'realEstateBuilding': 14,
    'travelsVacations': 15, 'pets': 16, 'religions': 17, 'citiesPlaces': 18,
    'industry': 19, 'transportation': 20, 'kidsParents': 21, 'all': 22
};

const INDUSTRY_MAP = {
    'marketingAds': 0, 'entertainmentLeisure': 1, 'services': 2, 'retail': 3,
    'businessFinance': 4, 'educationTraining': 5, 'foodBeverages': 6, 'artCrafts': 7,
    'fashionStyle': 8, 'healthWellness': 9, 'ecologyNature': 10, 'nonProfitCharity': 11,
    'nonProfit': 11,
    'beautyCosmetics': 12, 'techGadgets': 13, 'homeLiving': 14, 'familyKids': 15,
    'travelTourism': 16, 'sportFitness': 17, 'corporate': 18, 'petsAnimals': 19,
    'realEstateConstruction': 20, 'transportDelivery': 21, 'religionFaith': 22,
    'hrRecruitment': 23
};

const TYPE_MAP = {
    'svg': 0, // SvgElement
    'text': 1, // TextElement
    'image': 2, // ImageElement
    'background': 3 // ColoredBackground
    // 4 SvgMaskElement
};

// Font Mapping
const FONTS_LIST = [
    '', 'Montserrat', 'Bebas Neue', 'Raleway', 'Josefin Sans', 'Cantarell', 'Playfair Display',
    'Oswald', 'Blogger Sans', 'Abril Fatface', 'Prompt', 'Comfortaa', 'Rubik', 'Open Sans',
    'Roboto', 'Libre Baskerville', 'Quicksand', 'Dosis', 'Podkova', 'Lato', 'Cormorant Infant',
    'Amatic Sc', 'Fjalla One', 'Playlist Script', 'Arapey', 'Baloo Tamma', 'Graduate',
    'Titillium Web', 'Kreon', 'Nunito', 'Rammetto One', 'Anton', 'Poiret One', 'Alfa Slab One',
    'Play', 'Righteous', 'Space Mono', 'Frank Ruhl Libre', 'Yanone Kaffeesatz', 'Pacifico',
    'Bangers', 'Yellowtail', 'Droid Serif', 'Merriweather', 'Racing Sans One', 'Miriam Libre',
    'Crete Round', 'Rubik One', 'Bungee', 'Sansita One', 'Economica', 'Patua One', 'Caveat',
    'Philosopher', 'Limelight', 'Breathe', 'Rokkitt', 'Russo One', 'Tinos', 'Josefin Slab',
    'Oleo Script', 'Arima Madurai', 'Noticia Text', 'Kalam', 'Old Standard Tt', 'Playball',
    'Bad Script', 'Six Caps', 'Patrick Hand', 'Orbitron', 'Contrail One', 'Selima Script',
    'El Messiri', 'Bubbler One', 'Gravitas One', 'Italiana', 'Pompiere', 'Lemon Tuesday',
    'Vast Shadow', 'Sunday', 'Cookie', 'Exo 2', 'Barrio', 'Brusher Free Font', 'Radley',
    'Mrs Sheppards', 'Grand Hotel', 'Great Vibes', 'Maven Pro', 'Knewave', 'Damion',
    'Tulpen One', 'Parisienne', 'Superclarendon', 'Nixie One', 'Permanent Marker', 'Medula One',
    'Oxygen', 'Vollkorn', 'Cabin Sketch', 'Yeseva One', 'Montserrat Alternates', 'Satisfy',
    'Sacramento', 'Carter One', 'Glass Antiqua', 'Mr Dafoe', 'Lauren', 'Oranienbaum',
    'Scope One', 'Mr De Haviland', 'Pirou', 'Rise', 'Sensei', 'Yesteryear', 'Delius',
    'Copse', 'Sue Ellen Francisco', 'Monda', 'Pattaya', 'Dancing Script', 'Reem Kufi',
    'Playlist', 'Kaushan Script', 'Beacon', 'Reenie Beanie', 'Overlock', 'Mrs Saint Delafield',
    'Open Sans Condensed', 'Covered By Your Grace', 'Varela Round', 'Allura', 'Buda',
    'Brusher', 'Nothing You Could Do', 'Fredericka The Great', 'Arkana', 'Rochester',
    'Port Lligat Slab', 'Arimo', 'Dawning Of A New Day', 'Aldrich', 'Mikodacs', 'Neucha',
    'Heebo', 'Source Serif Pro', 'Shadows Into Two', 'Armata', 'Cutive Mono', 'Merienda One',
    'Rissatypeface', 'Stalemate', 'Assistant', 'Pathway Gothic One', 'Breathe Press',
    'Suez One', 'Berkshire Swash', 'Rakkas', 'Pinyon Script', 'Pt Sans', 'Delius Swash Caps',
    'Offside', 'Clicker Script', 'Mate', 'Kurale', 'Rye', 'Julius Sans One', 'Lalezar',
    'Quattrocento', 'Vt323', 'Bentham', 'Finger Paint', 'La Belle Aurore', 'Press Start 2P',
    'Junge', 'Iceberg', 'Inconsolata', 'Kelly Slab', 'Handlee', 'Rosario', 'Gaegu',
    'Homemade Apple', 'Londrina Shadow', 'Meddon', 'Gluk Foglihtenno06', 'Elsie Swash Caps',
    'Share Tech Mono', 'Black Ops One', 'Fauna One', 'Alice', 'Arizonia', 'Text Me One',
    'Nova Square', 'Bungee Shade', 'Just Me Again Down Here', 'Jacques Francois Shadow',
    'Cousine', 'Forum', 'Architects Daughter', 'Cedarville Cursive', 'Elsie', 'Sirin Stencil',
    'Vampiro One', 'Im Fell Dw Pica Sc', 'Dorsa', 'Marcellus Sc', 'Kumar One', 'Allerta Stencil',
    'Courgette', 'Rationale', 'Stint Ultra Expanded', 'Happy Monkey', 'Rock Salt',
    'Faster One', 'Bellefair', 'Wire One', 'Geo', 'Farsan', 'Chathura', 'Euphoria Script',
    'Zeyada', 'Jura', 'Loved By The King', 'League Script', 'Give You Glory', 'Znikomitno24',
    'Alegreya Sans', 'Kristi', 'Knewave Outline', 'Pangolin', 'Okolaks', 'Seymour One',
    'Didact Gothic', 'Kavivanar', 'Underdog', 'Alef', 'Italianno', 'Londrina Sketch',
    'Katibeh', 'Caesar Dressing', 'Lovers Quarrel', 'Iceland', 'Secular One',
    'Waiting For The Sunrise', 'David Libre', 'Marck Script', 'Kumar One Outline',
    'Znikomit', 'Monsieur La Doulaise', 'Gruppo', 'Monofett', 'Gfs Didot',
    'Petit Formal Script', 'Dukomdesign Constantine', 'Eb Garamond', 'Ewert', 'Bilbo',
    'Raleway Dots', 'Gabriela', 'Ruslan Display'
];

function getFontId(fontName) {
    if (!fontName) return 0;
    const idx = FONTS_LIST.indexOf(fontName);
    return idx === -1 ? 0 : idx;
}

/**
 * Generate Base64 key for JSON Preview
 * USES THE MAIN CANVAS directly to ensure WYSIWYG
 */
async function generatePreview() {
    const sourceCanvas = document.getElementById('main-canvas');
    if (!sourceCanvas) return '';

    // Create a 300px thumbnail
    const targetW = 300;
    const targetH = 300 * (sourceCanvas.height / sourceCanvas.width);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // Draw Source Canvas (scaled down)
    ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/png');
}

/**
 * Main Strict Export Function (Array of Objects Structure)
 */
export async function exportStrictJSON() {
    const state = store.get();

    // --- Root Level Fields ---

    // Group
    const groupCode = state.meta.sourceGroup || 'SM';
    const groupModeId = GROUP_MAP[groupCode] ?? 0;

    // Format
    let formatId = FORMAT_MAP[state.document.format] ?? 9;
    if (state.document.format === 'social-media-square') formatId = 1;

    // Category
    const catCode = state.document.category || 'all';
    const categoryId = CATEGORY_MAP[catCode] ?? 22;

    // Suitability
    const suitability = [0];

    // Keywords
    const keywords = state.document.keywords || [];

    // Industries
    const industries = (state.document.industries || ['marketingApps'])
        .map(i => INDUSTRY_MAP[i] ?? INDUSTRY_MAP['marketingAds'])
        .filter(x => x !== undefined);
    if (industries.length === 0) industries.push(0);

    // Preview: Use DOM Canvas snapshot
    const previewBase64 = await generatePreview();

    // --- Elements (Array of Objects) ---

    // Sort layers (back to front)
    const sortedLayers = state.layers.filter(l => l.visible);

    const elements = [];

    // --- Helper for Base64 (needed for JSON payload element data) ---
    const urlToBase64 = async (url) => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    };

    for (const l of sortedLayers) {
        // Type
        const tId = TYPE_MAP[l.content.type] ?? 0;

        // Transform
        // Use Pixels for consistency with 'canvas_width' field and example
        const left = l.transform.position.x * state.canvas.width;
        const top = l.transform.position.y * state.canvas.height;
        const width = l.transform.size.width * state.canvas.width;
        const height = l.transform.size.height * state.canvas.height;
        const angle = l.transform.rotation || 0.0;
        const opacity = l.opacity ?? 1.0;

        // Content Defaults
        let lColors = [];
        let lText = "";
        let lFont = 0;
        let lFontSize = 0.0;
        let lTextAlign = 0;
        let lCapitalize = false;
        let lLineHeight = 1.0;
        let lLetterSpacing = 0.0;

        // New Keys
        let lSVG = null;
        let lImageData = null;

        // Specific handling
        if (l.content.type === 'background') {
            if (l.content.fill && l.content.fill.colors) {
                lColors = l.content.fill.colors;
            }
            if (l.content.fill && l.content.fill.image) {
                lImageData = await urlToBase64(l.content.fill.image);
            }
        } else if (l.content.type === 'text') {
            const lines = l.content.lines || [];
            lText = lines.map(line => line.text).join('\n');

            if (lines.length > 0) {
                lFont = getFontId(lines[0].font);
                lFontSize = lines[0].fontSize;
                lLineHeight = lines[0].lineHeight || 1.0;
                lLetterSpacing = lines[0].letterSpacing || 0.0;
                if (lines[0].color) lColors.push(lines[0].color);
            }

            const alignMap = { '': 0, 'left': 1, 'center': 2, 'right': 3 };
            lTextAlign = alignMap[l.content.align] ?? 2;
            lCapitalize = l.content.capitalize || false;

        } else if (l.content.type === 'image') {
            lImageData = await urlToBase64(l.content.src);

        } else if (l.content.type === 'svg') {
            lSVG = l.content.xml;
            if (l.content.color) lColors.push(l.content.color);
        }

        // Construct Element Object
        const elementObj = {
            "type": tId,
            "left": left,
            "top": top,
            "width": width,
            "height": height,
            "color": lColors,
            "z_index": null,
            "opacity": opacity,
            "image_desc": null,
            "text": lText,
            "font": lFont,
            "font_size": lFontSize,
            "text_align": lTextAlign,
            "angle": angle,
            "capitalize": lCapitalize,
            "line_height": lLineHeight,
            "letter_spacing": lLetterSpacing,
            // New properties (populated only if relevant/non-null)
            "svg": lSVG,
            "image_data": lImageData
        };

        elements.push(elementObj);
    }

    // --- Final Object ---
    const finalObj = {
        id: state.meta.id,
        canvas_width: state.canvas.width,
        canvas_height: state.canvas.height,
        keywords: keywords,

        // Include Global Meta
        group: groupModeId,
        format: formatId,
        category: categoryId,
        title: state.document.title,
        suitability: suitability,
        industries: industries,
        preview: previewBase64,

        elements: elements
    };

    // --- Download ---
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalObj, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `${state.meta.id}.json`;
    link.click();
}

export async function exportProject() {
    await exportStrictJSON();
}

/**
 * Export to Image: Uses Shared Render Logic with 300 DPI Scaling
 */
export async function exportToImage(format = 'png', scale = 1) {
    const state = store.get();

    // Scale Factor
    // 1x = 1080px (if canvas is 1080)
    // 2x = 2160px
    const finalScale = scale;

    const width = state.canvas.width;
    const height = state.canvas.height;

    // Create Off-Screen Canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * finalScale);
    canvas.height = Math.ceil(height * finalScale);

    const ctx = canvas.getContext('2d');

    // Initial White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Reuse the main rendering logic from canvas.js
    // This ensures fonts, images (from cache), and SVGs are exactly as seen on screen.
    // AND it applies the Scale (DPI) automatically.
    renderStateToContext(ctx, state, width, height, finalScale);

    // Quality check
    let quality = 0.9;
    if (format === 'jpeg') quality = 0.95;

    const dataUrl = canvas.toDataURL(`image/${format}`, quality);

    const link = document.createElement('a');
    link.download = `${state.meta.id || 'design'}@${scale}x.${format}`;
    link.href = dataUrl;
    link.click();
}
