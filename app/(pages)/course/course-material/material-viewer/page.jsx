import MaterialHeader from '../../_components/materialHeader';
import MaterialContent from './_components/materialContent';

const MaterialViewer = () => {
  return (
    <>
      <div className="px-6">
        <MaterialHeader pageName={'Content Viewer'} />
        <MaterialContent
          materialContent={
            'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Veniam a fugit laudantium dolorem est nostrum tempore, eaque nesciunt rem at libero exercitationem illo ab, eum quaerat?'
          }
        />
      </div>
    </>
  );
};

export default MaterialViewer;
