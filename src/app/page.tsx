/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type p5 from 'p5'; // Import p5 type for type checking

// Custom p5 instance type to include our handleStartP5 method
interface CustomP5Instance extends p5 { // p5 will be available globally after dynamic import
  handleStartP5?: () => void;
}

export default function HomePage() {
    const sketchRef = useRef<HTMLDivElement>(null);
    const p5InstanceRef = useRef<CustomP5Instance | null>(null); 
    const [isClient, setIsClient] = useState(false);
    const [isStartedState, setIsStartedState] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
            const video = document.getElementById('video') as HTMLVideoElement;
            if (video) {
                video.srcObject = stream;
                video.play();
            }
        }).catch((error) => {
            console.error("Error getting user media:", error);
        });
    }, []);

    useEffect(() => {
        if (isClient && sketchRef.current && !p5InstanceRef.current) {
            import('p5').then(p5Module => {
                const P5 = p5Module.default; // p5 constructor
                const sketchProgram = (p: CustomP5Instance) => {
                    let capture: any;
                    let keywords: string[] = [];
                    let isFetchingKeywords = false;
                    let keywordUpdateIntervalId: NodeJS.Timeout | null = null;
                    let internalIsStarted = false;

                    p.setup = () => {
                        p.createCanvas(640, 480).parent(sketchRef.current!);
                        capture = p.createCapture("video");
                        if (capture) {
                            capture.size(640, 480);
                            capture.hide();
                        }
                    };

                    const handleStartP5Internal = () => {
                        if (internalIsStarted || !capture) return;
                        internalIsStarted = true;
                        setIsStartedState(true);

                        const startButtonElement = document.getElementById('startButton');
                        if (startButtonElement) {
                            startButtonElement.style.display = 'none';
                        }

                        const initialImageData = captureFrameAsBase64();
                        if (initialImageData) fetchKeywordsFromAPI(initialImageData);

                        if (keywordUpdateIntervalId) {
                            clearInterval(keywordUpdateIntervalId);
                        }
                        keywordUpdateIntervalId = setInterval(() => {
                            if (!isFetchingKeywords && capture) {
                                console.log("Interval: Capturing frame and fetching keywords...");
                                const imageData = captureFrameAsBase64();
                                if (imageData) fetchKeywordsFromAPI(imageData);
                            }
                        }, 10000);
                    };
                    p.handleStartP5 = handleStartP5Internal;

                    function captureFrameAsBase64(): string | null {
                        if (!capture || !p) return null;
                        const offscreenBuffer = p.createGraphics(p.width, p.height);
                        offscreenBuffer.image(capture, 0, 0, p.width, p.height);
                        const canvasEl = offscreenBuffer.elt as HTMLCanvasElement;
                        const dataUrl = canvasEl.toDataURL('image/jpeg');
                        offscreenBuffer.remove();
                        return dataUrl;
                    }

                    async function fetchKeywordsFromAPI(base64ImageData: string) {
                        if (!p) return;
                        console.log("Attempting to fetch keywords from Next.js backend...");
                        isFetchingKeywords = true;
                        try {
                            const response = await fetch('/api/generate-keywords', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ image: base64ImageData })
                            });
                            if (!response.ok) {
                                let errorData = { error: `API request failed with status ${response.status}` }; 
                                try {
                                    errorData = await response.json();
                                } catch {
                                    console.warn("Could not parse JSON error response from backend.");
                                    errorData.error = response.statusText || errorData.error;
                                }
                                throw new Error(errorData.error || 'Unknown server error');
                            }
                            const data = await response.json();
                            keywords = data.keywords || []; 
                            console.log("Keywords received from backend:", keywords);
                            if (keywords.length === 0) {
                                console.warn("Received empty keywords array from backend.");
                            }
                        } catch (error) {
                            console.error("Error fetching keywords:", error);
                            keywords = ["Error analyzing"];
                        } finally {
                            isFetchingKeywords = false;
                        }
                    }

                    p.draw = () => {
                        if (!capture || !p) return;
                        p.image(capture, 0, 0, p.width, p.height);

                        capture.loadPixels();
                        if (capture.pixels && capture.pixels.length > 0) {
                            let totalR = 0, totalG = 0, totalB = 0;
                            const pixels = capture.pixels;
                            const pixelCount = pixels.length / 4;
                            for (let i = 0; i < pixels.length; i += 4) {
                                totalR += pixels[i];
                                totalG += pixels[i + 1];
                                totalB += pixels[i + 2];
                            }
                            p.background(totalR / pixelCount, totalG / pixelCount, totalB / pixelCount);
                        } else {
                            p.background(0);
                        }

                        const hideRadiusPadding = 20; // Define a padding for the hide radius

                        for (let y = 0; y <= p.height; y += 15) {
                            for (let x = 0; x <= p.width; x += 15) {
                                const index = (x + y * p.width) * 4;
                                const pixels = capture.pixels;
                                if (pixels && index + 2 < pixels.length) {
                                    p.fill(pixels[index], pixels[index + 1], pixels[index + 2]);
                                } else {
                                    p.fill(255); // Default fill if pixels are not available
                                }

                                const currentTextSize = p.random(5, 20);
                                p.textSize(currentTextSize);
                                const displayText = keywords.length > 0 ? p.random(keywords) : "ABOUT ME";

                                // Calculate text bounds
                                const textW = p.textWidth(displayText);
                                const textX = x;
                                const textY = y; // y is the baseline for p.text

                                // Check if mouse is over this text with padding
                                // Text is drawn with baseline at y, extending upwards by currentTextSize
                                const mouseOverText = p.mouseX >= textX - hideRadiusPadding &&
                                                      p.mouseX <= textX + textW + hideRadiusPadding &&
                                                      p.mouseY >= textY - currentTextSize - hideRadiusPadding &&
                                                      p.mouseY <= textY + hideRadiusPadding;

                                if (!mouseOverText) {
                                    p.text(displayText, x, y);
                                }
                            }
                        }
                    };
                    p.remove = () => {
                        console.log("p5 sketch remove called");
                        if (keywordUpdateIntervalId) clearInterval(keywordUpdateIntervalId);
                    };
                };

                p5InstanceRef.current = new P5(sketchProgram) as CustomP5Instance;
            });
        }

        return () => {
            if (p5InstanceRef.current) {
                p5InstanceRef.current.remove();
                p5InstanceRef.current = null;
                console.log("p5 instance removed on component unmount");
            }
        };
    }, [isClient]);

    const handleReactStartButton = () => {
        if (p5InstanceRef.current && p5InstanceRef.current.handleStartP5) {
            p5InstanceRef.current.handleStartP5();
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black' }}>
            <video id="video" style={{ 
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1000,
            }}></video>
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                backdropFilter: 'blur(100px)',
                zIndex: 1000,
                transition: 'all 0.3s ease',
            }}></div>
            {isClient && !isStartedState && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center" style={{ zIndex: 2000 }}>
                    <div
                        id="startButton"
                        onClick={handleReactStartButton}
                        style={{
                            cursor: 'pointer',
                            padding: '12px 30px',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '15px',
                            color: 'white',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.3s ease',
                        }}
                    >
                        START
                    </div>
                </div>
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center" style={{ borderRadius: 10, zIndex: 1000 }}>
                <div id="sketch-holder" ref={sketchRef}  style={{ borderRadius: 10, overflow: 'hidden' }} className="w-[640px] h-[480px] mx-auto border border-gray-300 bg-black"></div>
            </div>
        </div>
    );
}
