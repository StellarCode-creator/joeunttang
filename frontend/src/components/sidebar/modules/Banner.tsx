export default function Banner() {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between overflow-hidden rounded-xl border border-blue-50 bg-[#F4F7FF] p-4">
        <div>
          <h4 className="text-[14px] font-bold text-gray-900">
            30초만에 리모델링 견적 신청
          </h4>
          <p className="mt-0.5 text-[11px] text-gray-500">
            이 집처럼 시공하면 견적 얼마나 들까?
          </p>
          <button className="mt-2 rounded bg-[#635BFF] px-2 py-1 text-[9px] font-bold text-white">
            견적 신청하기
          </button>
        </div>

        <div className="flex h-16 w-20 items-center justify-center rounded-lg bg-gray-200 text-[10px] font-bold text-gray-400 shadow-inner">
          IMAGE
        </div>
      </div>
    </div>
  );
}
