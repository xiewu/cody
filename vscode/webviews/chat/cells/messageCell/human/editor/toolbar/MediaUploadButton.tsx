import type { ContextItemMedia } from '@sourcegraph/cody-shared'
import { ImageIcon, XIcon } from 'lucide-react'
import type React from 'react'
import { useCallback, useRef, useState } from 'react'
import { URI } from 'vscode-uri'
import { Button } from '../../../../../../components/shadcn/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../../../components/shadcn/ui/tooltip'

export const ImageUploadButton: React.FC<{
    onMediaUpload?: (mediaContextItem: ContextItemMedia) => void
}> = ({ onMediaUpload }) => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (!file) {
                return
            }

            const reader = new FileReader()
            reader.onloadend = () => {
                const base64String = reader.result as string
                setUploadedImage(base64String) // Store the image data for the tooltip

                // Create a media context item
                const mediaItem = createMediaContextItem({
                    uri: URI.file(file.name),
                    mimeType: file.type,
                    filename: file.name,
                    data: base64String,
                    description: `Uploaded image: ${file.name}`,
                })

                onMediaUpload?.(mediaItem)
            }
            reader.readAsDataURL(file)
        },
        [onMediaUpload]
    )

    const handleClearImage = () => {
        setUploadedImage(null)
        // setMediaContextItem(null)
    }
    const handleButtonClick = () => {
        fileInputRef.current?.click()
    }
    return (
        <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size={uploadedImage ? 'sm' : 'icon'}
                    aria-label="Upload an image"
                >
                    <ImageIcon
                        onClick={handleButtonClick}
                        className="tw-w-8 tw-h-8"
                        strokeWidth={1.25}
                    />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                {uploadedImage ? (
                    <div className="tw-relative">
                        <img
                            src={uploadedImage}
                            alt="Uploaded Preview"
                            className="tw-max-w-xs tw-h-auto"
                        />
                        <Button
                            onClick={handleClearImage}
                            className="tw-absolute -tw-top-2 -tw-right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-p-0.5 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-red-500"
                            aria-label="Remove Image"
                        >
                            <XIcon
                                strokeWidth={1.25}
                                className="tw-h-8 tw-w-8"
                                onClick={() => handleClearImage()}
                            />
                        </Button>
                    </div>
                ) : (
                    'Upload an image'
                )}
            </TooltipContent>
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </Tooltip>
    )
}

function createMediaContextItem(params: {
    uri: URI
    mimeType: string
    filename: string
    data: string
    description?: string
}): ContextItemMedia {
    return {
        type: 'media',
        title: params.filename,
        uri: params.uri,
        mimeType: params.mimeType,
        filename: params.filename,
        data: params.data,
        description: params.description,
        content: params.data,
        size: params.data.length,
    }
}
