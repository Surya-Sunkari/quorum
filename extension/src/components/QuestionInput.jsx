import React, { useRef } from 'react';

function QuestionInput({ value, onChange, image, onImageChange, onSubmit, onKeyDown, disabled }) {
  const fileInputRef = useRef(null);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          convertToDataUrl(file);
        }
        break;
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      convertToDataUrl(file);
    }
  };

  const convertToDataUrl = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      onImageChange(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasContent = value.trim() || image;

  return (
    <div className="bg-white rounded-2xl shadow-bubbly p-4">
      {/* Image preview */}
      {image && (
        <div className="relative mb-3">
          <img
            src={image}
            alt="Pasted screenshot"
            className="max-h-40 rounded-xl border border-gray-200 object-contain"
          />
          <button
            onClick={removeImage}
            disabled={disabled}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
            title="Remove image"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={handlePaste}
        placeholder={image ? "Add a question about this image (optional)..." : "Ask a question or paste a screenshot..."}
        disabled={disabled}
        rows={3}
        className="w-full resize-none border-0 bg-transparent text-gray-800 placeholder-gray-400 focus:ring-0 focus:outline-none text-sm leading-relaxed"
      />

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Upload image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <span className="text-xs text-gray-400">
            Paste or upload image
          </span>
        </div>
        <button
          onClick={onSubmit}
          disabled={disabled || !hasContent}
          className="px-4 py-2 bg-gradient-to-r from-quorum-500 to-quorum-600 text-white text-sm font-medium rounded-xl shadow-bubbly hover:shadow-bubbly-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {disabled ? 'Asking...' : 'Ask'}
        </button>
      </div>
    </div>
  );
}

export default QuestionInput;
