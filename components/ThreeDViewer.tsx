import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Loader } from '@react-three/drei';
import { ARButton, XR, useXR, Interactive, XRInteractionEvent } from '@react-three/xr';
import { Group, Mesh } from 'three';
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
        if (clickedMesh && clickedMesh.type === 'Mesh' && clickedMesh.name && !['Scene', 'RootNode'].includes(clickedMesh.name)) {
            const partName = clickedMesh.name.replace(/_/g, ' ');
            setAnnotation({ pos: event.point.toArray(), text: `Thinking about ${partName}...` });
            setIsLoading(true);
            try {
                const explanation = await apiService.getAIExplanationForModelPart(item.title, partName);
                setAnnotation({ pos: event.point.toArray(), text: explanation });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                setAnnotation({ pos: event.point.toArray(), text: errorMessage });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return <primitive object={scene} onClick={handleClick} />;
};

// Component for the AR experience
function ARExperience({ item, setAnnotation }: { item: ExplorationItem, setAnnotation: (ann: AnnotationState) => void }) {
    const modelContainerRef = useRef<Group>(null!);
    const reticleRef = useRef<Mesh>(null!);
    const [isPlaced, setIsPlaced] = useState(false);
    
    // Preload scene for AR
    const { scene } = useGLTF(item.modelUrl);
    
    // State for AR model manipulation
    const [scale, setScale] = useState(0.2);
    const [rotationY, setRotationY] = useState(0);

    const { isPresenting, session, player } = useXR()
    const hitTestSourceRef = useRef<any | null>(null);

    useEffect(() => {
        if (!isPresenting || !session) return;
        
        const setupHitTestSource = async () => {
            try {
                const viewerReferenceSpace = await session.requestReferenceSpace!('viewer');
                const source = await session.requestHitTestSource!({ space: viewerReferenceSpace });
                hitTestSourceRef.current = source;
            } catch (error) {
                console.error("Failed to create hit test source:", error);
            }
        };
        
        setupHitTestSource();
      
        return () => {
          if (hitTestSourceRef.current) {
            hitTestSourceRef.current.cancel();
          }
          hitTestSourceRef.current = null;
        }
    }, [isPresenting, session]);

    useFrame((_, frame) => {
        if (!isPresenting || !hitTestSourceRef.current || isPlaced || !frame) {
            if (reticleRef.current) reticleRef.current.visible = false;
            return;
        };
        
        const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
        
        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const referenceSpace = player; // useXR returns player which is the XRReferenceSpace
            const pose = hit.getPose(referenceSpace);
            if (reticleRef.current && pose) {
                reticleRef.current.matrix.fromArray(pose.transform.matrix);
                reticleRef.current.matrix.decompose(reticleRef.current.position, reticleRef.current.quaternion, reticleRef.current.scale);
                reticleRef.current.visible = true;
            }
        } else {
            if (reticleRef.current) {
                reticleRef.current.visible = false;
            }
        }
    });

    // Place the model on tap
    const placeModel = (event: XRInteractionEvent) => {
        if (reticleRef.current?.visible && !isPlaced) {
            modelContainerRef.current.position.setFromMatrixPosition(reticleRef.current.matrix);
            setIsPlaced(true);
            reticleRef.current.visible = false;
        }
    };

    const [isLoading, setIsLoading] = useState(false);

    const handlePartClick = async (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        if (isLoading || !isPlaced) return;

        const clickedMesh = event.object;
        if (clickedMesh && clickedMesh.type === 'Mesh' && clickedMesh.name && !['Scene', 'RootNode'].includes(clickedMesh.name)) {
            const partName = clickedMesh.name.replace(/_/g, ' ');
            setAnnotation({ pos: event.point.toArray(), text: `Thinking about ${partName}...` });
            setIsLoading(true);
            try {
                const explanation = await apiService.getAIExplanationForModelPart(item.title, partName);
                setAnnotation({ pos: event.point.toArray(), text: explanation });
            } catch (error) {
                setAnnotation({ pos: event.point.toArray(), text: (error as Error).message });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <>
            <ambientLight intensity={2.0} />
            <Interactive onSelect={placeModel}>
                <mesh ref={reticleRef} visible={false}>
                    <ringGeometry args={[0.05, 0.07, 32]} />
                    <meshBasicMaterial color="white" />
                </mesh>
            </Interactive>
            
            <group ref={modelContainerRef}>
                {isPlaced && (
                    <>
                        <primitive
                            object={scene.clone()} // Clone to be safe
                            onClick={handlePartClick}
                            scale={scale}
                            rotation-y={rotationY}
                        />
                        <Html center>
                            <div className="ar-controls" onClick={(e) => e.stopPropagation()}>
                                <label htmlFor="scale-slider">Scale</label>
                                <input
                                    id="scale-slider"
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.05"
                                    value={scale}
                                    onChange={(e) => setScale(parseFloat(e.target.value))}
                                />
                                <label htmlFor="rotation-slider">Rotate</label>
                                <input
                                    id="rotation-slider"
                                    type="range"
                                    min={-Math.PI}
                                    max={Math.PI}
                                    step="0.1"
                                    value={rotationY}
                                    onChange={(e) => setRotationY(parseFloat(e.target.value))}
                                />
                            </div>
                        </Html>
                    </>
                )}
            </group>
        </>
    );
}

// Wrapper component to manage context and state
function ViewerContent({ item, user }: ThreeDViewerProps) {
    const { isPresenting } = useXR();
    const [annotation, setAnnotation] = useState<AnnotationState>(null);

    return (
        <>
            {isPresenting ? (
                <ARExperience item={item} setAnnotation={setAnnotation} />
            ) : (
                <>
                    <ambientLight intensity={1.5} />
                    <directionalLight position={[5, 5, 5]} intensity={2} />
                    <directionalLight position={[-5, -5, -5]} intensity={1} />
                    <Suspense fallback={null}>
                        <Model item={item} setAnnotation={setAnnotation} />
                    </Suspense>
                    <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
                </>
            )}

            {annotation && (
                <Annotation
                    position={annotation.pos}
                    text={annotation.text}
                    onClose={() => setAnnotation(null)}
                />
            )}
        </>
    );
}

const ThreeDViewer: React.FC<ThreeDViewerProps> = ({ item, user }) => {
    return (
        <div className="w-full h-[70vh] bg-gray-800 rounded-lg relative overflow-hidden shadow-2xl">
            <ARButton
                sessionInit={{ requiredFeatures: ['hit-test'] }}
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 10,
                    padding: '12px 24px',
                    background: 'white',
                    color: 'black',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                }}
            />
            <Canvas
                camera={{ position: [0, 0, 5], fov: 60 }}
                onClick={() => { /* The child component will now handle annotation state */ }}
            >
                <XR>
                    <ViewerContent item={item} user={user} />
                </XR>
            </Canvas>
            <Loader
                containerStyles={{
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                innerStyles={{ width: '100px', height: '10px' }}
                barStyles={{ height: '10px', background: '#22d3ee' }}
                dataStyles={{ color: 'white', fontSize: '14px', marginTop: '10px' }}
            />
            <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-gray-900/50 p-2 rounded-md">
                Click on parts of the model to learn more.
            </div>
        </div>
    );
};

export default ThreeDViewer;
