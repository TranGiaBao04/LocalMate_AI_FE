// Hàng 5 sao chỉ để xem. value có thể lẻ (4.3): tô theo số đã làm tròn.
export default function RatingStars({ value = 0, size = 16 }) {
  const filled = Math.round(value);
  return (
    <span role="img" aria-label={`${value} trên 5 sao`} className="inline-flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          aria-hidden="true"
          className="material-symbols-outlined"
          style={{
            fontSize: size,
            color: star <= filled ? "#efb515" : "#bacac5",
            fontVariationSettings: star <= filled ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          star
        </span>
      ))}
    </span>
  );
}
