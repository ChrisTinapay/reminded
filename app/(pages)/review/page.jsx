import CTA from '@/app/_components/CTA';
import ReviewHeader from './_components/reviewHeader';
import Question from './_components/Question';

const Review = () => {
  return (
    <div className="flex flex-col gap-8 p-6">
      <ReviewHeader />
      <Question />
      <CTA
        styles="bg-purple-600 text-gray-50 text-base font-bold font-poppins leading-6"
        text="Next Question"
      />
    </div>
  );
};

export default Review;
