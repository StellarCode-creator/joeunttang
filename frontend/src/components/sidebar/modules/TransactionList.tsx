'use client';

interface Transaction {
  date: string;    // 계약일
  price: string;   // 가격
  area: string;    // 면적
  building: string;// 거래동
  floor: string;   // 층
  isRegistered: boolean; // 등기 여부
}

export default function TransactionList() {
  // 샘플 데이터 (이미지 기준 구성)
  const transactions: Transaction[] = [
    { date: '2026.01', price: '4.7억', area: '84.362㎡', building: '302동', floor: '6층', isRegistered: true },
    { date: '2026.01', price: '3.9억', area: '66.441㎡', building: '305동', floor: '6층', isRegistered: false },
    { date: '2026.01', price: '5.2억', area: '84.362㎡', building: '301동', floor: '4층', isRegistered: true },
    { date: '2025.12', price: '4.3억', area: '66.441㎡', building: '308동', floor: '2층', isRegistered: true },
    { date: '2025.12', price: '4.4억', area: '66.441㎡', building: '304동', floor: '11층', isRegistered: false },
  ];

  return (
    <div className="flex flex-col w-full font-sans bg-white">
      {/* 헤더 영역 (항목명 표시) */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-gray-50/50 text-[12px] font-bold text-gray-500">
        <div className="w-[20%]">계약일</div>
        <div className="w-[20%] text-right">가격</div>
        <div className="w-[20%] text-right">면적</div>
        <div className="w-[15%] text-right">동</div>
        <div className="w-[10%] text-right">층</div>
        <div className="w-[15%] text-center">정보</div>
      </div>

      {/* 실거래 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {transactions.map((item, index) => (
          <div 
            key={index} 
            className="flex items-center px-4 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {/* 1. 계약일 */}
            <div className="w-[20%] text-[13px] text-gray-400 font-medium">
              {item.date}
            </div>

            {/* 2. 가격 */}
            <div className="w-[20%] text-[14px] font-black text-gray-900 text-right">
              {item.price}
            </div>

            {/* 3. 면적 */}
            <div className="w-[20%] text-[13px] text-gray-500 text-right">
              {item.area}
            </div>

            {/* 4. 거래동 */}
            <div className="w-[15%] text-[13px] text-gray-500 text-right">
              {item.building}
            </div>

            {/* 5. 층 */}
            <div className="w-[10%] text-[13px] text-gray-500 text-right">
              {item.floor}
            </div>

            {/* 6. 정보 (등기 여부) */}
            <div className="w-[15%] text-center">
              {item.isRegistered ? (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  등기
                </span>
              ) : (
                <span className="text-[10px] text-gray-300">-</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}