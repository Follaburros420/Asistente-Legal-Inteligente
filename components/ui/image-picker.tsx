import Image from "next/image"
import { ChangeEvent, FC, useState } from "react"
import { toast } from "sonner"
import { Input } from "./input"

interface ImagePickerProps {
  src: string
  image: File | null
  onSrcChange: (src: string) => void
  onImageChange: (image: File) => void
  width?: number
  height?: number
}

const ImagePicker: FC<ImagePickerProps> = ({
  src,
  image,
  onSrcChange,
  onImageChange,
  width = 200,
  height = 200
}) => {
  const [previewSrc, setPreviewSrc] = useState<string>(src)
  const [previewImage, setPreviewImage] = useState<File | null>(image)

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0]

      if (file.size > 6000000) {
        toast.error("¡La imagen debe pesar menos de 6MB!")
        return
      }

      const url = URL.createObjectURL(file)

      const img = new window.Image()
      img.src = url

      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          toast.error("No se pudo crear el contexto del canvas.")
          return
        }

        const size = Math.min(img.width, img.height)
        canvas.width = size
        canvas.height = size

        ctx.drawImage(
          img,
          (img.width - size) / 2,
          (img.height - size) / 2,
          size,
          size,
          0,
          0,
          size,
          size
        )

        const squareUrl = canvas.toDataURL()

        setPreviewSrc(squareUrl)
        setPreviewImage(file)
        onSrcChange(squareUrl)
        onImageChange(file)
      }
    }
  }

  return (
    <div>
      {previewSrc && (
        <Image
          style={{ width: `${width}px`, height: `${width}px` }}
          className="rounded"
          height={width}
          width={width}
          src={previewSrc}
          alt={"Image"}
        />
      )}

      <button
        type="button"
        className="hover:bg-secondary mt-2 w-full cursor-pointer rounded border-2 px-4 py-2 text-sm transition-colors"
        onClick={() => document.getElementById(`file-input-${width}`)?.click()}
      >
        Seleccionar archivo
      </button>
      <Input
        id={`file-input-${width}`}
        className="hidden"
        type="file"
        accept="image/png, image/jpeg, image/jpg"
        onChange={handleImageSelect}
      />
    </div>
  )
}

export default ImagePicker
