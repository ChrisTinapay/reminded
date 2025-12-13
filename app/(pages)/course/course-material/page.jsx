import MaterialHeader from '../_components/materialHeader';
import MaterialCard from './_components/materialCard';

const CourseMaterial = () => {
  return (
    <>
      <div className="px-6">
        <MaterialHeader pageName={'Course Materials'} />
        <div className="flex flex-wrap gap-6  justify-center items-center">
          {/* put the logic here ok 😤 */}
          <MaterialCard course={'Module 1: Python Programming Language'} />
          <MaterialCard course={'Module 2: Introduction to Data Types'} />
          <MaterialCard course={'Module 3: Common Operations'} />
        </div>
      </div>
    </>
  );
};

export default CourseMaterial;
