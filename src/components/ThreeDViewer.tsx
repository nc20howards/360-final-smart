

import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Loader } from '@react-three/drei';
import { ARButton, XR, useXR, Interactive, XRInteractionEvent } from '@react-three/xr';
import { Group, Mesh } from 'three';
// FIX: Import missing types
import { ExplorationItem, User } from '../types';
import * as apiService from '../services/apiService';

// FIX: Define the ThreeDViewerProps interface that is used by multiple components in this file.
export interface ThreeDViewerProps {
    item: ExplorationItem;
    user: User;
}

type AnnotationState = {
    pos: [number, number, number];
    text: string;
} | null;

// Annotation component to display AI feedback
const Annotation = ({ position, text, onClose }: { position: [number, number, number], text: string, onClose: () => void }) => {
    return (
        <Html position={position}>
            <div
                className="max-w-xs bg-gray-900 bg-opacity-80 backdrop-blur-sm text-white p-3 rounded-lg shadow-lg border border-cyan-500/50 animate-slide-in-left-fade"
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing it
            >
                <button onClick={onClose} className="absolute top-1 right-1 text-gray-400 hover:text-white">&times;</button>
                <p className="text-sm">{text}</p>
            </div>
        </Html>
    );
};


// Model component for the standard 3D view
const Model = ({ item, setAnnotation }: { item: ExplorationItem, setAnnotation: (ann: AnnotationState) => void }) => {
    const { scene } = useGLTF(item.modelUrl);
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        if (isLoading) return;

        const clickedMesh = event.object;
