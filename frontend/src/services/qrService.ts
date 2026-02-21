import jsQR from 'jsqr';

export const decodeQRCode = async (base64Image: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) {
                resolve(null);
                return;
            }

            canvas.width = image.width;
            canvas.height = image.height;
            context.drawImage(image, 0, 0);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {

                resolve(code.data);
            } else {
                resolve(null);
            }
        };
        image.onerror = () => resolve(null);
        image.src = base64Image;
    });
};
